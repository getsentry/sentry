import {Fragment} from 'react';
import styled from '@emotion/styled';

import tracingKeyboardShortcuts from 'sentry-images/spot/tracing-keyboard-shortcuts.svg';

import {type ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const KEYBOARD_SHORTCUTS: Array<[string, string]> = [
  ['\u2191 / \u2193', t('Navigate up or down')],
  ['\u2190 / \u2192', t('Collapse or expand')],
  [t('Shift') + ' + \u2191 / \u2193', t('Jump to first/last element')],
];

const TIMELINE_SHORTCUTS: Array<[string, string]> = [
  [t('Cmd / Ctrl + Scroll'), t('Zoom in/out at cursor')],
  [t('Shift + Scroll'), t('Scroll horizontally')],
  [t('Double click'), t('Zoom to fill')],
];

export function TraceShortcutsModal({Header, Body}: ModalRenderProps) {
  return (
    <Fragment>
      <Header closeButton>
        <h2>{t('Shortcuts')}</h2>
      </Header>
      <Body>
        <ShortcutsLayout>
          <div>
            <Shortcuts>
              {KEYBOARD_SHORTCUTS.map(([key, description]) => (
                <Shortcut key={key}>
                  <strong>{key}</strong>
                  <div>{description}</div>
                </Shortcut>
              ))}
              {TIMELINE_SHORTCUTS.map(([key, description]) => (
                <Shortcut key={key}>
                  <strong>{key}</strong>
                  <div>{description}</div>
                </Shortcut>
              ))}
            </Shortcuts>
          </div>
          <div>
            <img src={tracingKeyboardShortcuts} alt={t('Sentry cant fix this')} />
          </div>
        </ShortcutsLayout>
      </Body>
    </Fragment>
  );
}

const ShortcutsLayout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 38%;
  gap: ${space(2)};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const Shortcuts = styled('ul')`
  list-style-type: none;
  margin-bottom: 0;
  padding: 0;
  font-size: ${p => p.theme.fontSize.sm};

  &:not(:last-child) {
    margin: 0 0 ${space(3)} 0;
  }
`;

const Shortcut = styled('li')`
  height: 28px;
  display: grid;
  grid-template-columns: min-content 1fr;

  strong {
    display: inline-block;
    min-width: 130px;
    color: ${p => p.theme.tokens.content.accent};
  }
`;
