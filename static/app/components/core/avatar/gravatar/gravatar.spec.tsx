import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/entry-point
import {Gravatar} from './gravatar';

describe('Gravatar', () => {
  it('renders the image with remote size', async () => {
    render(<Gravatar remoteSize={100} gravatarId="example@example.com" />);

    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      expect.stringContaining(`s=100`)
    );
  });

  it('hashes the provided gravatarId', async () => {
    render(<Gravatar remoteSize={100} gravatarId="example@example.com" />);

    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      'https://gravatar.com/avatar/31c5543c1734d25c7206f5fd591525d0295bec6fe84ff82f946a34fe970a1e66?d=404&s=100'
    );
  });
});
