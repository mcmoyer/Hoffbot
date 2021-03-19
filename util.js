/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Right pads a string with spaces until is hit the {count}
 * @param str
 * @param count
 * @returns {string}
 */
function rpad(str, count) {
  return ((str + Array(count+1).join(" ")).substr(0,count));
}

export default {shuffle, rpad}