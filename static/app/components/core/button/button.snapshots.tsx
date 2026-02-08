import {Button} from '@sentry/scraps/button';

describe('Button', () => {
  it.snapshot('button-default', () => <Button>Default</Button>);

  it.snapshot('button-primary', () => <Button priority="primary">Primary</Button>);

  it.snapshot('button-primary-dark', {theme: 'dark'}, () => (
    <Button priority="primary">Primary</Button>
  ));

  it.snapshot('button-danger', () => <Button priority="danger">Danger</Button>);
});
