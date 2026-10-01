import {ShortId} from './shortId';

describe('ShortId', () => {
  it.snapshot('default', () => (
    <div style={{padding: 8}}>
      <ShortId shortId="JAVASCRIPT-ABC" />
    </div>
  ));

  it.snapshot('with-avatar', () => (
    <div style={{padding: 8}}>
      <ShortId
        shortId="JAVASCRIPT-ABC"
        avatar={
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#6C5FC7',
            }}
          />
        }
      />
    </div>
  ));

  it.snapshot('overflow', () => (
    <div style={{padding: 8, width: 80}}>
      <ShortId shortId="VERY-LONG-PROJECT-IDENTIFIER-12345" />
    </div>
  ));
});
