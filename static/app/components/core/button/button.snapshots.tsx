import {Button} from '@sentry/scraps/button';

describe('Button', () => {
  it.snapshot('Default', () => <Button>Default</Button>);

  it.snapshot('Primary', () => <Button priority="primary">Primary</Button>);

  it.snapshot('Primary (dark)', {theme: 'dark'}, () => (
    <Button priority="primary">Primary</Button>
  ));

  it.snapshot('Danger', () => <Button priority="danger">Danger</Button>);
});
