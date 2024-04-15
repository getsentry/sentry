import {type CSSProperties, Fragment, useCallback, useRef} from 'react';
import {findDOMNode} from 'react-dom';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/profiling/flex';
import {Tooltip} from 'sentry/components/tooltip';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {selectText} from 'sentry/utils/selectText';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

interface Props {
  feedbackIssue: FeedbackIssue;
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackItemUsername({className, feedbackIssue, style}: Props) {
  const name = feedbackIssue.metadata.name;
  const email = feedbackIssue.metadata.contact_email;

  const nameOrEmail = name || email;
  const isSameNameAndEmail = name === email;

  const user = name && email && !isSameNameAndEmail ? `${name} <${email}>` : nameOrEmail;

  const userNodeRef = useRef<HTMLInputElement>(null);

  const handleSelectText = useCallback(() => {
    if (!userNodeRef.current) {
      return;
    }

    // We use findDOMNode here because `this.userNodeRef` is not a dom node,
    // it's a ref to AutoSelectText
    const node = findDOMNode(userNodeRef.current); // eslint-disable-line react/no-find-dom-node
    if (!node || !(node instanceof HTMLElement)) {
      return;
    }

    selectText(node);
  }, []);

  const {onClick: handleCopyToClipboard} = useCopyToClipboard({
    text: user ?? '',
  });

  if (!name && !email) {
    return <strong>{t('Anonymous User')}</strong>;
  }

  return (
    <Flex align="center" gap={space(1)} className={className} style={style}>
      <Tooltip title={t('Click to copy')} containerDisplayMode="flex">
        <Flex
          align="center"
          wrap="wrap"
          gap={space(0.5)}
          onClick={() => {
            handleSelectText();
            handleCopyToClipboard();
          }}
          ref={userNodeRef}
        >
          {isSameNameAndEmail ? (
            <strong>{name ?? email}</strong>
          ) : (
            <Fragment>
              <strong>{name ?? t('No Name')}</strong>
              <Purple>•</Purple>
              <strong>{email ?? t('No Email')}</strong>
            </Fragment>
          )}
        </Flex>
      </Tooltip>
      {email ? (
        <Tooltip title={t(`Email %s`, user)} containerDisplayMode="flex">
          <LinkButton
            href={`mailto:${email}`}
            external
            icon={<IconMail color="gray300" />}
            aria-label={t(`Email %s`, user)}
            borderless
            size="zero"
          />
        </Tooltip>
      ) : null}
    </Flex>
  );
}

const Purple = styled('span')`
  color: ${p => p.theme.purple300};
`;
