export default size => {
  if (size > 9) return (size - 9) * 100;

  switch (size) {
    case 0:
      return 0;
    case 1:
      return 2;
    case 2:
      return 4;
    case 3:
      return 6;
    case 4:
      return 10;
    case 5:
      return 16;
    case 6:
      return 20;
    case 7:
      return 24;
    case 8:
      return 36;
    case 9:
      return 60;
    default:
      return 16;
  }
};
