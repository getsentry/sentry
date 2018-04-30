const space = size => {
  switch (size) {
    //Our spacing scale is based on a base unit of 8
    //We use a case switch to prevent odd numbers, decimals, and big numbers.
    case 0:
      return '0';
    case 0.25:
      return '2px';
    case 0.5:
      return '4px';
    case 1:
      return '8px';
    case 2:
      return '16px';
    case 3:
      return '20px';
    case 4:
      return '30px';
    default:
      return '8px';
  }
};

export default space;
