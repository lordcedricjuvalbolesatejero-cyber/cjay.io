/* ============================================================
   CALCULATOR LOGIC
   - Click number  → appears on big screen
   - Click operator → operator shown on small side screen
   - Click 2nd num  → operator on small screen disappears
   - Click =        → result shown on big screen
============================================================ */

'use strict';

/* ── DOM refs ─────────────────────────────────────────── */
const bigDisplay    = document.getElementById('bigDisplay');
const expressionHint = document.getElementById('expressionHint');
const smallDisplay  = document.getElementById('smallDisplay');
const btnAC   = document.getElementById('btn-ac');
const btnC    = document.getElementById('btn-c');

/* ── State ────────────────────────────────────────────── */
let firstOperand   = null;   // stored first number (as string)
let operator       = null;   // current operator symbol
let currentInput   = '0';    // what's being typed right now
let shouldResetBig = false;  // flag: next digit replaces display
let justCalculated = false;  // flag: result was just shown

/* ── Operator map ─────────────────────────────────────── */
const OP_MAP = { '÷': '/', '×': '*', '−': '-', '+': '+' };

/* ================================================================
   DISPLAY HELPERS
================================================================ */
function formatNumber(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;

  // Limit decimal places to avoid float noise
  const str = parseFloat(n.toPrecision(12)).toString();

  // Add thousands separators to integer part only
  const [intPart, decPart] = str.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

function setBigDisplay(value, flashResult = false) {
  const raw   = String(value).replace(/,/g, '');
  const label = formatNumber(raw);

  bigDisplay.classList.remove('result-flash', 'error', 'shrink', 'shrink-more');

  const len = label.length;
  if (len > 14) bigDisplay.classList.add('shrink-more');
  else if (len > 9) bigDisplay.classList.add('shrink');

  bigDisplay.textContent = label;

  if (flashResult) {
    requestAnimationFrame(() => {
      bigDisplay.classList.add('result-flash');
    });
  }
}

function setSmallDisplay(content, animate = false) {
  smallDisplay.classList.remove('show-op', 'hide-op');

  if (content === '—' || content === '') {
    smallDisplay.textContent = '—';
    return;
  }

  smallDisplay.textContent = content;

  if (animate) {
    void smallDisplay.offsetWidth; // force reflow
    smallDisplay.classList.add('show-op');
  }
}

function hideSmallOperator() {
  if (smallDisplay.textContent !== '—') {
    smallDisplay.classList.remove('show-op');
    smallDisplay.classList.add('hide-op');
    setTimeout(() => {
      smallDisplay.textContent = '—';
      smallDisplay.classList.remove('hide-op');
    }, 200);
  }
}

function setExpressionHint(text) {
  expressionHint.textContent = text;
}

function clearActiveOpButtons() {
  document.querySelectorAll('.btn-op.active-op')
    .forEach(b => b.classList.remove('active-op'));
}

/* ================================================================
   CORE CALCULATION
================================================================ */
function calculate(a, op, b) {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (isNaN(numA) || isNaN(numB)) return NaN;

  switch (op) {
    case '+': return numA + numB;
    case '-': return numA - numB;
    case '*': return numA * numB;
    case '/':
      if (numB === 0) return 'Error: ÷0';
      return numA / numB;
    default: return NaN;
  }
}

/* ================================================================
   INPUT HANDLERS
================================================================ */

/* ── Number / Dot input ───────────────────────────────── */
function handleNumber(value) {
  // After hitting = , start fresh with new number
  if (justCalculated) {
    currentInput   = '0';
    justCalculated = false;
    firstOperand   = null;
    operator       = null;
    clearActiveOpButtons();
    setExpressionHint('');
  }

  // If operator was just chosen, second operand starts
  if (shouldResetBig) {
    currentInput   = '0';
    shouldResetBig = false;

    // Operator disappears from small screen as user types 2nd number
    hideSmallOperator();
  }

  if (value === '.') {
    if (currentInput.includes('.')) return; // only one dot
    currentInput += '.';
  } else {
    currentInput = currentInput === '0' ? value : currentInput + value;
  }

  setBigDisplay(currentInput);
}

/* ── Operator input ───────────────────────────────────── */
function handleOperator(opSymbol) {
  // If mid-chain (first + op already set) calculate previous before applying new
  if (operator && !shouldResetBig) {
    const result = calculate(firstOperand, OP_MAP[operator], currentInput);
    if (typeof result === 'string') {
      showError(result);
      return;
    }
    const resultStr = String(parseFloat(result.toPrecision(12)));
    firstOperand = resultStr;
    setBigDisplay(resultStr);
  } else {
    firstOperand = currentInput;
  }

  operator       = opSymbol;
  shouldResetBig = true;
  justCalculated = false;

  // Highlight active operator button
  clearActiveOpButtons();
  const opBtn = document.querySelector(`.btn-op[data-value="${opSymbol}"]`);
  if (opBtn) opBtn.classList.add('active-op');

  // Show operator on small screen
  setSmallDisplay(opSymbol, true);

  // Show hint above big screen: "firstOperand op"
  setExpressionHint(`${formatNumber(firstOperand)} ${opSymbol}`);
}

/* ── Equals ───────────────────────────────────────────── */
function handleEquals() {
  if (operator === null || firstOperand === null) return;

  const secondOperand = currentInput;
  const result = calculate(firstOperand, OP_MAP[operator], secondOperand);

  if (typeof result === 'string') {
    showError(result);
    return;
  }

  const resultStr = String(parseFloat(result.toPrecision(12)));

  // Build expression string
  const expr = `${formatNumber(firstOperand)} ${operator} ${formatNumber(secondOperand)}`;

  // Update hint line
  setExpressionHint(`${expr} =`);

  // Show result on big screen
  setBigDisplay(resultStr, true);

  // Small screen resets
  setSmallDisplay('—');

  clearActiveOpButtons();

  // Reset state
  currentInput   = resultStr;
  firstOperand   = null;
  operator       = null;
  justCalculated = true;
  shouldResetBig = false;
}

/* ── Special functions ────────────────────────────────── */
function handleFunction(fn) {
  const num = parseFloat(currentInput);

  switch (fn) {
    case '%':
      currentInput = String(num / 100);
      setBigDisplay(currentInput);
      break;

    case '±':
      currentInput = String(num * -1);
      setBigDisplay(currentInput);
      break;

    case '√': {
      if (num < 0) { showError('Error: √neg'); return; }
      const sq = Math.sqrt(num);
      currentInput = String(parseFloat(sq.toPrecision(12)));
      setBigDisplay(currentInput, true);
      setExpressionHint(`√${formatNumber(String(num))}`);
      break;
    }
  }
}

/* ── All Clear ────────────────────────────────────────── */
function handleAC() {
  currentInput   = '0';
  firstOperand   = null;
  operator       = null;
  shouldResetBig = false;
  justCalculated = false;

  setBigDisplay('0');
  setSmallDisplay('—');
  setExpressionHint('');
  clearActiveOpButtons();


}

/* ── Clear (delete last char) ─────────────────────────── */
function handleC() {
  if (justCalculated) {
    handleAC();
    return;
  }

  if (currentInput.length <= 1 || currentInput === 'Error') {
    currentInput = '0';
  } else {
    currentInput = currentInput.slice(0, -1);
    if (currentInput === '-') currentInput = '0';
  }
  setBigDisplay(currentInput);
}

/* ── Error display ────────────────────────────────────── */
function showError(msg) {
  bigDisplay.textContent = msg;
  bigDisplay.classList.add('error');
  setSmallDisplay('!');
  setExpressionHint('');

  currentInput   = '0';
  firstOperand   = null;
  operator       = null;
  shouldResetBig = false;
  justCalculated = false;
  clearActiveOpButtons();
}



/* ================================================================
   EVENT LISTENERS
================================================================ */

/* Number & dot buttons */
document.querySelectorAll('.btn-num').forEach(btn => {
  btn.addEventListener('click', () => handleNumber(btn.dataset.value));
});

/* Operator buttons */
document.querySelectorAll('.btn-op').forEach(btn => {
  btn.addEventListener('click', () => handleOperator(btn.dataset.value));
});

/* Equals */
document.getElementById('btn-equal').addEventListener('click', handleEquals);

/* Function buttons */
document.querySelectorAll('.btn-func').forEach(btn => {
  btn.addEventListener('click', () => handleFunction(btn.dataset.value));
});

/* AC */
btnAC.addEventListener('click', handleAC);

/* C */
btnC.addEventListener('click', handleC);

/* ── Keyboard support ─────────────────────────────────── */
const KEY_MAP = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': '.',
  '+': '+',  '-': '−', '*': '×', '/': '÷',
  'Enter': '=', '=': '=',
  'Backspace': 'C',
  'Escape': 'AC',
  '%': '%',
};

document.addEventListener('keydown', (e) => {
  const mapped = KEY_MAP[e.key];
  if (!mapped) return;
  e.preventDefault();

  if (['0','1','2','3','4','5','6','7','8','9','.'].includes(mapped)) {
    handleNumber(mapped);
    flashBtn(`btn-${mapped === '.' ? 'dot' : mapped}`);
  } else if (['+','−','×','÷'].includes(mapped)) {
    handleOperator(mapped);
  } else if (mapped === '=') {
    handleEquals();
    flashBtn('btn-equal');
  } else if (mapped === 'C') {
    handleC();
    flashBtn('btn-c');
  } else if (mapped === 'AC') {
    handleAC();
    flashBtn('btn-ac');
  } else if (mapped === '%') {
    handleFunction('%');
    flashBtn('btn-percent');
  }
});

function flashBtn(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 120);
}

/* ── Init ─────────────────────────────────────────────── */
setBigDisplay('0');
setSmallDisplay('—');
