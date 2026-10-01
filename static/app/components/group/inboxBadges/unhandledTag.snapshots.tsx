import {UnhandledTag} from './unhandledTag';

describe('UnhandledTag', () => {
  it.snapshot('default', () => (
    <div style={{padding: 8}}>
      <UnhandledTag />
    </div>
  ));
});
