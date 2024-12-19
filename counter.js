const incrementUp = (function() {
    let n = 0;
  
    return function() {
      n += 1;
      return n;
    }
  })();

export default incrementUp; 