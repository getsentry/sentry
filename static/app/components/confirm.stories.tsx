import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Confirm, {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

export default Storybook.story('Confirm', story => {
  story('Triggers', () => {
    const [state, setState] = useState('empty');

    return (
      <Fragment>
        <p>
          There are two ways to use <Storybook.JSXNode name="Confirm" />, either as a
          wrapper around a trigger, or by calling <code>openConfirmModal()</code> in a
          callback.
        </p>
        <p>
          It's recommended to call <code>openConfirmModal()</code>.
        </p>
        <p>Current state is: {state}.</p>
        <Storybook.SideBySide>
          <Button
            onClick={() =>
              openConfirmModal({
                onConfirm: () => {
                  setState('confirmed');
                },
                onCancel: () => {
                  setState('cancelled');
                },
              })
            }
          >
            <code>{'onClick={() => openConfirmModal({})}'}</code>
          </Button>
          <Confirm
            onConfirm={() => setState('confirmed')}
            onCancel={() => setState('cancelled')}
          >
            <Button>
              Button is wrapped with <Storybook.JSXNode name="Confirm" />
            </Button>
          </Confirm>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Labels', () => (
    <Fragment>
      <p>
        You must implement at least{' '}
        <Storybook.JSXProperty name="message" value={String} />, but have the option of
        implementing <Storybook.JSXProperty name="renderMessage" value={Function} />{' '}
        instead.
      </p>
      <Storybook.SideBySide>
        <Button
          onClick={() =>
            openConfirmModal({
              header: 'Are you sure?',
              message: 'You are about to delete everything.',
              cancelText: 'No thanks',
              confirmText: 'Just do it!',
              priority: 'danger',
            })
          }
        >
          With String Labels
        </Button>
        <Button
          onClick={() =>
            openConfirmModal({
              renderMessage: _props => (
                <span>
                  You are about to delete <em>Everything!</em>
                </span>
              ),
              renderCancelButton: ({closeModal}) => (
                <Link
                  to="#"
                  onClick={e => {
                    closeModal();
                    e.stopPropagation();
                  }}
                >
                  Nevermind
                </Link>
              ),
              renderConfirmButton: ({defaultOnClick}) => (
                <Button onClick={defaultOnClick}>Just do it</Button>
              ),
            })
          }
        >
          With ReactNode Labels
        </Button>
      </Storybook.SideBySide>
    </Fragment>
  ));

  story('Async Confirmations', () => {
    return (
      <Fragment>
        <p>
          If you pass a promise to{' '}
          <Storybook.JSXProperty name="onConfirm" value={Function} />, the modal will not
          close until the promise is resolved. This is useful if you have actions that
          require a endpoint to respond before the modal can be closed, such as when
          confirming the deletion of the page you are on.
        </p>
        <Confirm
          onConfirm={() => new Promise(resolve => setTimeout(resolve, 1000))}
          header="Are you sure?"
          message="This confirmation takes 1 second to complete"
        >
          <Button>This confirmation takes 1 second to complete</Button>
        </Confirm>
        <p>
          This also allows you to respond to display errors in the modal in the case of
          network errors.
        </p>
        <Confirm
          onConfirm={() => new Promise((_, reject) => setTimeout(reject, 1000))}
          header="Are you sure?"
          message="This confirmation will error"
          errorMessage="Custom error message"
        >
          <Button>This confirmation will error</Button>
        </Confirm>
      </Fragment>
    );
  });

  story('Callbacks & bypass={true}', () => {
    const [callbacks, setCallbacks] = useState<string[]>([]);
    return (
      <Fragment>
        <p>
          There is also a prop called{' '}
          <Storybook.JSXProperty name="bypass" value={Boolean} />. This can help to skip
          the Confirm dialog, for example if not enough items are selected in a
          bulk-change operation, and directly run the{' '}
          <Storybook.JSXProperty name="onConfirm" value={Function} /> callback.
        </p>
        <Storybook.SideBySide>
          <Button
            onClick={() =>
              openConfirmModal({
                bypass: false,
                onRender: () => setCallbacks(prev => prev.concat('onRender')),
                onConfirming: () => setCallbacks(prev => prev.concat('onConfirming')),
                onCancel: () => setCallbacks(prev => prev.concat('onCancel')),
                onConfirm: () => setCallbacks(prev => prev.concat('onConfirm')),
                onClose: () => setCallbacks(prev => prev.concat('onClose')),
              })
            }
          >
            With callbacks (bypass = false)
          </Button>
          <Button
            onClick={() =>
              openConfirmModal({
                bypass: true,
                onRender: () => setCallbacks(prev => prev.concat('onRender')),
                onConfirming: () => setCallbacks(prev => prev.concat('onConfirming')),
                onCancel: () => setCallbacks(prev => prev.concat('onCancel')),
                onConfirm: () => setCallbacks(prev => prev.concat('onConfirm')),
                onClose: () => setCallbacks(prev => prev.concat('onClose')),
              })
            }
          >
            With callbacks (bypass = true)
          </Button>
        </Storybook.SideBySide>
        <p>
          <label>
            Callback debugger:
            <br />
            <textarea rows={4} value={callbacks.join('\n')} />
            <br />
            <button onClick={() => setCallbacks([])}>Reset</button>
          </label>
        </p>
      </Fragment>
    );
  });

  story('<Confirm> child render func', () => (
    <Fragment>
      <p>
        Here's an example where <Storybook.JSXProperty name="children" value={Function} />{' '}
        is a render function:
      </p>
      <Confirm>{({open}) => <Button onClick={open}>Open the modal</Button>}</Confirm>
    </Fragment>
  ));

  story('<Confirm> specific props', () => {
    const [clicks, setClicks] = useState(0);

    return (
      <Fragment>
        <p>
          We can see how <Storybook.JSXProperty name="disabled" value={Boolean} /> and
          <Storybook.JSXProperty name="stopPropagation" value={Boolean} /> work in
          combination.
        </p>
        <p>Button clicks: {clicks} </p>
        <Storybook.PropMatrix
          propMatrix={{
            disabled: [false, true],
            stopPropagation: [false, true],
          }}
          render={props => (
            <Button onClick={() => setClicks(prev => prev + 1)}>
              <Confirm {...props}>
                <ModalTrigger>Click the green area to open modal</ModalTrigger>
              </Confirm>
            </Button>
          )}
          selectedProps={['disabled', 'stopPropagation']}
        />
      </Fragment>
    );
  });
});

const ModalTrigger = styled('span')`
  background: ${p => p.theme.colors.green200};
  padding: ${space(1)};
`;
