import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {IssueOwnership} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

type Props = {
  dateUpdated: string | null;
  initialText: string;
  onCancel: () => void;
  organization: Organization;
  /**
   * Used for analytics
   */
  page: 'issue_details' | 'project_settings';
  project: Project;
  disabled?: boolean;
  onSave?: (ownership: IssueOwnership) => void;
};

type InputError = {raw: string[]};

function parseError(error: InputError | null) {
  const text = error?.raw?.[0];
  if (!text) {
    return null;
  }

  if (text.startsWith('Invalid rule owners:')) {
    return <InvalidOwners>{text}</InvalidOwners>;
  }
  return <SyntaxOverlay line={parseInt(text.match(/line (\d*),/)?.[1] ?? '', 10) - 1} />;
}

export function OwnerInput({
  dateUpdated,
  disabled = false,
  initialText,
  onCancel,
  onSave,
  organization,
  page,
  project,
}: Props) {
  const [hasChanges, setHasChanges] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<InputError | null>(null);

  const handleUpdateOwnership = () => {
    setError(null);

    const api = new Client();
    const request = api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/ownership/`,
      {
        method: 'PUT',
        data: {raw: text || ''},
      }
    );

    request
      .then(ownership => {
        addSuccessMessage(t('Updated issue ownership rules'));
        setHasChanges(false);
        setText(text);
        onSave?.(ownership);
        trackIntegrationAnalytics('project_ownership.saved', {
          page,
          organization,
          net_change:
            (text?.split('\n').filter(x => x).length ?? 0) -
            initialText.split('\n').filter(x => x).length,
        });
      })
      .catch(caught => {
        setError(caught.responseJSON);
        if (caught.status === 403) {
          addErrorMessage(
            t(
              "You don't have permission to modify issue ownership rules for this project"
            )
          );
        } else if (
          caught.status === 400 &&
          caught.responseJSON.raw?.[0].startsWith('Invalid rule owners:')
        ) {
          addErrorMessage(
            t(
              'Unable to save issue ownership rule changes: %s',
              caught.responseJSON.raw[0]
            )
          );
        } else {
          addErrorMessage(t('Unable to save issue ownership rule changes'));
        }
      });

    return request;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHasChanges(true);
    setText(e.target.value);
  };

  return (
    <Fragment>
      <div
        style={{position: 'relative'}}
        onKeyDown={e => {
          if (e.metaKey && e.key === 'Enter') {
            handleUpdateOwnership();
          }
        }}
      >
        <Panel>
          <PanelHeader>
            {t('Ownership Rules')}

            {dateUpdated && (
              <SyncDate>
                {t('Last Edited')} <TimeSince date={dateUpdated} />
              </SyncDate>
            )}
          </PanelHeader>
          <PanelBody>
            <StyledTextArea
              aria-label={t('Ownership Rules')}
              placeholder={
                '#example usage\n' +
                'path:src/example/pipeline/* person@sentry.io #infra\n' +
                'module:com.module.name.example #sdks\n' +
                'url:http://example.com/settings/* #product\n' +
                'tags.sku_class:enterprise #enterprise'
              }
              monospace
              onChange={handleChange}
              disabled={disabled}
              value={defined(text) ? text : initialText}
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </PanelBody>
        </Panel>
        <ActionBar>
          <div>{parseError(error)}</div>
          <Grid flow="column" align="center" gap="md">
            <Button type="button" size="sm" onClick={onCancel}>
              {t('Cancel')}
            </Button>
            <Button
              size="sm"
              priority="primary"
              onClick={handleUpdateOwnership}
              disabled={disabled || !hasChanges}
            >
              {t('Save')}
            </Button>
          </Grid>
        </ActionBar>
      </div>
    </Fragment>
  );
}

const TEXTAREA_PADDING = 4;
const TEXTAREA_LINE_HEIGHT = 24;

const ActionBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
`;

const SyntaxOverlay = styled('div')<{line: number}>`
  position: absolute;
  top: ${({line}) => TEXTAREA_PADDING + line * TEXTAREA_LINE_HEIGHT + 1}px;
  width: 100%;
  height: ${TEXTAREA_LINE_HEIGHT}px;
  background-color: ${p => p.theme.tokens.background.danger.vibrant};
  opacity: 0.1;
  pointer-events: none;
`;

const StyledTextArea = styled(TextArea)`
  min-height: 140px;
  overflow: auto;
  outline: 0;
  width: 100%;
  resize: none;
  margin: 1px 0 0 0;
  word-break: break-all;
  white-space: pre-wrap;
  padding-top: ${TEXTAREA_PADDING}px;
  line-height: ${TEXTAREA_LINE_HEIGHT}px;
  height: 450px;
  border-width: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
`;

const InvalidOwners = styled('div')`
  color: ${p => p.theme.tokens.content.danger};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-top: 12px;
`;

const SyncDate = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  text-transform: none;
`;
