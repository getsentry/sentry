export default size => {
  switch (size) {
    case 0:
      return '0';
    case 1:
      return '2px';
    case 2:
      return '4px';
    case 3:
      return '6px';
    case 4:
      return '10px';
    case 5:
      return '16px';
    case 6:
      return '20px';
    default:
      return '16px';
  }
};
