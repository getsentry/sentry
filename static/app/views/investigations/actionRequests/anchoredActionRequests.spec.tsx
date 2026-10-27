import {render} from 'sentry-test/reactTestingLibrary';

import {AnchoredActionRequests} from 'sentry/views/investigations/actionRequests/anchoredActionRequests';
import {InvestigationActionRequestFixture} from 'sentry/views/investigations/fixtures';
import type {InvestigationActionRequest} from 'sentry/views/investigations/types';

const aboutCause = {
  primary: false,
  anchor: {type: 'hypothesis', id: 'hypothesis-1', blockId: null},
} as const;

function renderRequests(actionRequests: InvestigationActionRequest[]) {
  return render(
    <AnchoredActionRequests
      actionRequests={actionRequests}
      investigationId="investigation-1"
    />
  );
}

describe('AnchoredActionRequests', () => {
  it('renders nothing when every request is hidden', () => {
    const {container} = renderRequests([
      InvestigationActionRequestFixture({
        ...aboutCause,
        title: 'Old advice',
        state: 'superseded',
        canApply: false,
        cannotApplyReason: 'not_suggested',
      }),
    ]);

    expect(container).toBeEmptyDOMElement();
  });
});
