export default size => {
  if (size > 9) return (size - 9) * 100;

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
    case 7:
      return '24px';
    case 8:
      return '36px';
    case 9:
      return '60px';
    default:
      return '16px';
  }
};
