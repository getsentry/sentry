import {bandRect} from './bandShapes';

const track = {left: 0, right: 600};

describe('bandRect', () => {
  it('rounds only the corners on the ends of the track', () => {
    expect(bandRect({left: 0, right: 30}, 0, track, 'red')).toMatchObject({
      shape: {r: [2, 0, 0, 2]},
    });
    expect(bandRect({left: 30, right: 60}, 0, track, 'red')).toMatchObject({
      shape: {r: [0, 0, 0, 0]},
    });
    expect(bandRect({left: 570, right: 600}, 0, track, 'red')).toMatchObject({
      shape: {r: [0, 2, 2, 0]},
    });
  });
});
