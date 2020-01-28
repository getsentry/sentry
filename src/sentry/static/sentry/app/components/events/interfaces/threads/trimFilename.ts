function trimFilename(filename: string) {
  const pieces = filename.split(/\//g);
  return pieces[pieces.length - 1].split('.')[0].toLowerCase();
}

export default trimFilename;
