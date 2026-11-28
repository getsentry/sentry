import {COMMENT_ATTACHMENT_UPLOAD_HEADERS} from './commentAttachmentButton';

describe('comment attachment upload client', () => {
  const {Client} = jest.requireActual('sentry/api');
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(window, 'fetch').mockResolvedValue(
      new Response('{"id": "5"}', {
        status: 201,
        headers: {'Content-Type': 'application/json'},
      })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function videoForm() {
    const data = new FormData();
    data.set('file', new File(['data'], 'video_1.mp4', {type: 'video/mp4'}));
    return data;
  }

  it('lets the browser set the multipart Content-Type', async () => {
    const client = new Client({headers: COMMENT_ATTACHMENT_UPLOAD_HEADERS});

    await client.requestPromise('/organizations/org-slug/issues/1/comment-attachments/', {
      method: 'POST',
      data: videoForm(),
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(new Headers(init.headers).get('Content-Type')).toBeNull();
  });

  it('the default client would label the upload as JSON', async () => {
    const client = new Client();

    await client.requestPromise('/organizations/org-slug/issues/1/comment-attachments/', {
      method: 'POST',
      data: videoForm(),
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
});
