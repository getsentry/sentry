import styled from '@emotion/styled';

import TextArea from 'sentry/components/forms/controls/textarea';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {IconGithub, IconGitlab, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  'data-test-id': string;
  dateUpdated: string | null;
  raw: string;
  type: 'codeowners' | 'issueowners';
  controls?: React.ReactNode[];
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
        return <IconGithub size="md" />;
      case 'gitlab':
        return <IconGitlab size="md" />;
      default:
        return <IconSentry size="md" />;
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
      <PanelHeader>
        <Container>
          {renderIcon()}
          <Title>{renderTitle()}</Title>
          {repoName && <Repository>{`- ${repoName}`}</Repository>}
        </Container>
        <Container>
          {dateUpdated && (
            <SyncDate>
              {t('Last %s', type === 'codeowners' ? t('synced') : t('edited'))}{' '}
              <TimeSince date={dateUpdated} />
            </SyncDate>
          )}
          <Controls>{controls}</Controls>
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
  text-transform: none;
`;

const Title = styled('div')`
  padding: 0 ${space(0.5)} 0 ${space(1)};
  font-size: initial;
`;

const Repository = styled('div')``;

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
  padding: 0 ${space(1)};
  font-weight: normal;
`;
const Controls = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
