import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Confirm, {openConfirmModal} from 'sentry/components/confirm';
import Link from 'sentry/components/links/link';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import Matrix from 'sentry/components/stories/matrix';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook(Confirm, story => {
  story('Triggers', () => {
    const [state, setState] = useState('empty');

    return (
      <Fragment>
        <p>
          There are two ways to use <JSXNode name="Confirm" />, either as a wrapper around
          a trigger, or by calling <code>openConfirmModal()</code> in a callback.
        </p>
        <p>
          It&apos;s recommended to call <code>openConfirmModal()</code>.
        </p>
        <p>Current state is: {state}.</p>
        <SideBySide>
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
              Button is wrapped with <JSXNode name="Confirm" />
            </Button>
          </Confirm>
        </SideBySide>
      </Fragment>
    );
  });

  story('Labels', () => (
    <Fragment>
      <p>
        You must implement at least <JSXProperty name="message" value={String} />, but
        have the option of implementing{' '}
        <JSXProperty name="renderMessage" value={Function} /> instead.
      </p>
      <SideBySide>
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
      </SideBySide>
    </Fragment>
  ));

  story('Callbacks & bypass={true}', () => {
    const [callbacks, setCallbacks] = useState<string[]>([]);
    return (
      <Fragment>
        <p>
          There is also a prop called <JSXProperty name="bypass" value={Boolean} />. This
          can help to skip the Confirm dialog, for example if not enough items are
          selected in a bulk-change operation, and directly run the{' '}
          <JSXProperty name="onConfirm" value={Function} /> callback.
        </p>
        <SideBySide>
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
        </SideBySide>
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
        Here&apos;s an example where <JSXProperty name="children" value={Function} /> is a
        render function:
      </p>
      <Confirm>{({open}) => <Button onClick={open}>Open the modal</Button>}</Confirm>
    </Fragment>
  ));

  story('<Confirm> specific props', () => {
    const [clicks, setClicks] = useState(0);

    return (
      <Fragment>
        <p>
          We can see how <JSXProperty name="disabled" value={Boolean} /> and
          <JSXProperty name="stopPropagation" value={Boolean} /> work in combination.
        </p>
        <p>Button clicks: {clicks} </p>
        <Matrix
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
  background: ${p => p.theme.green200};
  padding: ${space(1)};
`;
