const responseDiv = document.getElementById("response");
const clearButton = document.getElementById("clear");
const canvas = document.getElementById("canvas");
const toggleButtons = Array.from(document.getElementById('toggleButtons').children);
const ctx = canvas.getContext('2d');

/* -------------------------------------------------------------------------- */
/*                                     API                                    */
/* -------------------------------------------------------------------------- */

const MAX_RESULTS = 10;
const API = 'https://inputtools.google.com/request?itc=ja-t-i0-handwrit&app=translate';
const DEVICE = navigator.userAgent

const generateRequestData = strokes => ({
  app_version: 0.4,
  api_level: '537.36',
  device: DEVICE,
  input_type: 0,
  options: 'enable_pre_space',
  requests: [
    {
      writing_guide: {
        writing_area_width: canvas.width,
        writing_area_height: canvas.height
      },
      pre_context: '',
      max_num_results: MAX_RESULTS,
      max_completions: 0,
      language: 'ja',
      ink: strokes
    }
  ]
});

const sendKanjiRequest = async (strokes) => fetch(API, {
  headers: { "content-type": "application/json; charset=UTF-8" },
  body: JSON.stringify(generateRequestData(strokes)),
  method: "POST"
})
  .then(data => data.json())
  .then(res => {
    if (res[0] != "SUCCESS") throw Error(res[0]);
    return res;
  });
  

const updateResponses = async (strokes) => 
  sendKanjiRequest(strokes)
    .then(res => responseDiv.innerText = postProcess(res[1][0][1]).join(', '))
    .catch(err => console.error(err));

/* -------------------------------------------------------------------------- */
/*                                   CANVAS                                   */
/* -------------------------------------------------------------------------- */

const MILLISECONDS_PER_POINT = 20;

canvas.height = 500;
canvas.width = 500;

ctx.strokeStyle = 'black';
ctx.lineWidth = 2;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

let strokes = [];

let newStroke = {};
let mouseDown = false;
let drawingTimeout = -1;
let timerStart = 0;
let x = 0;
let y = 0;

const resetNewStroke = () => {
  newStroke = {
    'xs': [],
    'ys': [],
    'times': [],
  };
}

resetNewStroke();

const addPointToNewStroke = (x, y) => {
  newStroke.xs.push(x);
  newStroke.ys.push(y);
  newStroke.times.push(Date.now() - timerStart);
}

const drawLine = (dx, dy) => {
  ctx.moveTo(x, y);
  ctx.lineTo(dx, dy);
  ctx.stroke();
}

const updateStroke = (newX, newY) => {
  drawLine(newX, newY);
  addPointToNewStroke(newX, newY);
  x = newX;
  y = newY;
  drawingTimeout = -1;
}

const initStroke = (initX, initY) => {
  resetNewStroke();
  timerStart = Date.now();
  x = initX;
  y = initY;
  mouseDown = true;
  ctx.beginPath();
}

const updateStrokeIfPrevLineIsDone = (newX, newY) => {
  if (mouseDown === true && drawingTimeout === -1)
    drawingTimeout = setTimeout(
      () => updateStroke(newX, newY),
      MILLISECONDS_PER_POINT
    );
}

const endStroke = () => {
  if (!(drawingTimeout === -1)) {
    clearTimeout(drawingTimeout);
    drawingTimeout = -1;
  }
  mouseDown = false;
  ctx.closePath();
  strokes.push([newStroke.xs, newStroke.ys, newStroke.times]);
  updateResponses(strokes);
}

const clearBoard = () => {
  strokes = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  responseDiv.innerHTML = 'None';
}

/* -------------------------------------------------------------------------- */
/*                        POST-PROCESSING AND FILTERING                       */
/* -------------------------------------------------------------------------- */

const ON_COLOR = '#4d9e2a';
const OFF_COLOR = '#fa2b2b';

const regexState = {
  state: {
    kanji: true,
    hiragana: true,
    katakana: true,
    all: false
  },
  regex: {
    kanji: RegExp(/\p{Script_Extensions=Han}/u),
    hiragana: RegExp(/\p{Script_Extensions=Hiragana}/u),
    katakana: RegExp(/\p{Script_Extensions=Katakana}/u),
    all: RegExp(/./)
  }
};

const genCharSet = id => id.slice(6).toLowerCase();

const colorButton = id => {
  const button = document.getElementById(id);
  button.style.backgroundColor =
    regexState.state[genCharSet(id)] ? ON_COLOR : OFF_COLOR;
}

const toggleRegexState = event => {
  const characterSet = genCharSet(event.target.id);

  regexState.state[characterSet] = !regexState.state[characterSet];
  colorButton(event.target.id);
  if (strokes.length !== 0) updateResponses(strokes);
}

const genCombinedRegexString = () => '^[' +
  Object.keys(regexState.regex)
    .filter(key => regexState.state[key])
    .map(key => regexState.regex[key].source)
    .join('') + ']*$';

const postProcess = results => {
  const regexString = regexState.state.all
  ? '.*'
  : genCombinedRegexString();

  const combinedRegex = RegExp(`${regexString}`, 'u');
  return results.filter(result => combinedRegex.test(result));
}

/* -------------------------------------------------------------------------- */
/*                          EVENT LISTENERS AND SETUP                         */
/* -------------------------------------------------------------------------- */

// Add eventlisteners and colors to all toggle-buttons
toggleButtons
  .map(button => {
    button.addEventListener('click', toggleRegexState);
    colorButton(button.id);
  });
  
  canvas.onmousedown = event => initStroke(event.offsetX, event.offsetY);
  canvas.onmousemove = event => updateStrokeIfPrevLineIsDone(event.offsetX, event.offsetY);
  canvas.onmouseup = () => endStroke();
  clearButton.onclick = () => clearBoard();

// Touch support

const correctTouchOffset = (x, y) => {
const canvasRect = canvas.getBoundingClientRect();
return [
  (x - canvasRect.left) * canvas.width / canvasRect.width,
  (y - canvasRect.top) * canvas.width / canvasRect.width
];
}

canvas.ontouchstart = event => {
  event.preventDefault();
  ({clientX, clientY} = event.changedTouches[0]);
  [x, y] = correctTouchOffset(clientX, clientY);
  initStroke(x, y);
}

canvas.ontouchmove = event => {
  event.preventDefault();
  ({clientX, clientY} = event.changedTouches[0]);
  [x, y] = correctTouchOffset(clientX, clientY);
  updateStrokeIfPrevLineIsDone(x, y);
}

canvas.ontouchend = () => endStroke();
