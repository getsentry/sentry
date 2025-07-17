export function getFrameId(frame: any, index: number) {
  return `${frame.offsetMs}-${index}`;
}

export function getFrameIndexById(frames: any[], id: string) {
  return frames.findIndex((frame, i) => getFrameId(frame, i) === id);
}
