import styled from '@emotion/styled';

import TextArea from 'sentry/components/forms/controls/textarea';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TimeSince from 'sentry/components/timeSince';
import {IconGithub, IconGitlab, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  dateUpdated: string | null;
  raw: string;
  type: 'codeowners' | 'issueowners';
  controls?: React.ReactNode[];
  'data-test-id'?: string;
  placeholder?: string;
  provider?: string;
  repoName?: string;
};

function RulesPanel({
  raw,
  dateUpdated,
  provider,
  repoName,
  type,
  placeholder,
  controls,
  ['data-test-id']: dataTestId,
}: Props) {
  function renderIcon() {
    switch (provider ?? '') {
      case 'github':
        return <IconGithub size="sm" />;
      case 'gitlab':
        return <IconGitlab size="sm" />;
      default:
        return <IconSentry size="sm" />;
    }
  }

  function renderTitle() {
    switch (type) {
      case 'codeowners':
        return 'CODEOWNERS';
      case 'issueowners':
        return 'Ownership Rules';
      default:
        return null;
    }
  }

  return (
    <Panel data-test-id={dataTestId}>
      <PanelHeader hasButtons>
        <Container>
          {renderIcon()}
          {renderTitle()}
          {repoName && <div>{`- ${repoName}`}</div>}
        </Container>
        <Container>
          {dateUpdated && (
            <SyncDate>
              {t('Last %s', type === 'codeowners' ? t('synced') : t('edited'))}{' '}
              <TimeSince date={dateUpdated} />
            </SyncDate>
          )}
          {controls}
        </Container>
      </PanelHeader>

      <PanelBody>
        <InnerPanelBody>
          <StyledTextArea
            monospace
            readOnly
            value={raw}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            placeholder={placeholder}
          />
        </InnerPanelBody>
      </PanelBody>
    </Panel>
  );
}

export default RulesPanel;

const Container = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const InnerPanelBody = styled(PanelBody)`
  height: auto;
`;

const StyledTextArea = styled(TextArea)`
  height: 350px !important;
  overflow: auto;
  outline: 0;
  width: 100%;
  resize: none;
  margin: 0;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: ${space(3)};
  border: none;
  box-shadow: none;
  color: transparent;
  text-shadow: 0 0 0 #9386a0;

  &:hover,
  &:focus,
  &:active {
    border: none;
    box-shadow: none;
  }
`;

const SyncDate = styled('div')`
  font-weight: normal;
  text-transform: none;
`;
