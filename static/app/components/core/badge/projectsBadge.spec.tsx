import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {ProjectsBadge} from '@sentry/scraps/badge';

/**
 * The spec draws each size as a fixed square with contents sized to it, so the
 * sizes are checked against those numbers rather than against a ratio.
 */
function boxes(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[class]'))
    .map(node => getEmotionRules(node as HTMLElement).join(' '))
    .map(rules => ({
      width: /width:\s*([\d.]+)px/.exec(rules)?.[1],
      height: /height:\s*([\d.]+)px/.exec(rules)?.[1],
      top: /top:\s*(-?[\d.]+)px/.exec(rules)?.[1],
      left: /left:\s*(-?[\d.]+)px/.exec(rules)?.[1],
      radius: /border-radius:\s*(\d+)px/.exec(rules)?.[1],
    }))
    .filter(box => box.width);
}

function iconSize(container: HTMLElement) {
  return container.querySelector('svg')?.getAttribute('width');
}

describe('ProjectsBadge', () => {
  describe('md', () => {
    it('fills the 16px frame with a single platform', () => {
      const {container} = render(<ProjectsBadge projectPlatforms={['javascript']} />);

      const [frame, tile] = boxes(container);
      expect(frame).toMatchObject({width: '16', height: '16'});
      expect(tile).toMatchObject({width: '16', height: '16', radius: '3'});
    });

    it('insets two stacked platforms so the pair spans the frame', () => {
      const {container} = render(
        <ProjectsBadge projectPlatforms={['javascript', 'python']} />
      );

      const [frame, first, second] = boxes(container);
      expect(frame).toMatchObject({width: '16', height: '16'});
      expect(first).toMatchObject({width: '11', top: '0', left: '0', radius: '3'});
      expect(second).toMatchObject({width: '11', top: '5', left: '5'});
    });

    it('draws the no-project icon at the full frame', () => {
      const {container} = render(<ProjectsBadge projectPlatforms={[]} />);

      expect(iconSize(container)).toBe('16px');
    });
  });

  describe('lg', () => {
    it('insets a single platform inside the 24px frame', () => {
      const {container} = render(
        <ProjectsBadge projectPlatforms={['javascript']} size="lg" />
      );

      const [frame, tile] = boxes(container);
      expect(frame).toMatchObject({width: '24', height: '24'});
      // Centred in the frame, which is the spec's 2px on each edge.
      expect(tile).toMatchObject({width: '20', height: '20', radius: '4'});
    });

    it('insets two stacked platforms so the pair spans the frame', () => {
      const {container} = render(
        <ProjectsBadge projectPlatforms={['javascript', 'python']} size="lg" />
      );

      const [frame, first, second] = boxes(container);
      expect(frame).toMatchObject({width: '24', height: '24'});
      expect(first).toMatchObject({width: '16', top: '0', left: '0', radius: '4'});
      expect(second).toMatchObject({width: '16', top: '8', left: '8'});
    });

    it('insets the no-project icon', () => {
      const {container} = render(<ProjectsBadge projectPlatforms={[]} size="lg" />);

      expect(iconSize(container)).toBe('20px');
    });
  });

  it('is decorative — it names a platform, not a project', () => {
    render(<ProjectsBadge projectPlatforms={['javascript']} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
