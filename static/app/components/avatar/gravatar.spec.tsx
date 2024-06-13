import {render, screen} from 'sentry-test/reactTestingLibrary';

import Gravatar from './gravatar';

describe('Gravatar', () => {
  it('renders the image with remote size', async () => {
    const remoteSize = 100;
    render(<Gravatar remoteSize={remoteSize} />);

    const imageElement = await screen.findByRole('img');
    expect(imageElement).toHaveAttribute(
      'src',
      expect.stringContaining(`s=${remoteSize}`)
    );
  });

  it('hashes the provided gravatarId', async () => {
    const gravatarId = 'example@example.com';
    render(<Gravatar remoteSize={100} gravatarId={gravatarId} />);

    const imageElement = await screen.findByRole('img');
    expect(imageElement).toHaveAttribute(
      'src',
      'https://gravatar.com/avatar/31c5543c1734d25c7206f5fd591525d0295bec6fe84ff82f946a34fe970a1e66?d=404&s=100'
    );
  });
});
