import TextareaAutosize from 'react-autosize-textarea';
import styled from '@emotion/styled';
import moment from 'moment';

import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconGithub, IconGitlab, IconSentry} from 'sentry/icons';
import {inputStyles} from 'sentry/styles/input';
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
        {[
          <Container key="title">
            {renderIcon()}
            <Title>{renderTitle()}</Title>
            {repoName && <Repository>{`- ${repoName}`}</Repository>}
          </Container>,
          <Container key="control">
            <SyncDate>
              {dateUpdated && `Last synced ${moment(dateUpdated).fromNow()}`}
            </SyncDate>
            <Controls>
              {(controls || []).map((c, n) => (
                <span key={n}> {c}</span>
              ))}
            </Controls>
          </Container>,
        ]}
      </PanelHeader>

      <PanelBody>
        <InnerPanelBody>
          <StyledTextArea
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

const StyledTextArea = styled(TextareaAutosize)`
  ${p => inputStyles(p)};
  height: 350px !important;
  overflow: auto;
  outline: 0;
  width: 100%;
  resize: none;
  margin: 0;
  font-family: ${p => p.theme.text.familyMono};
  word-break: break-all;
  white-space: pre-wrap;
  line-height: ${space(3)};
  border: none;
  box-shadow: none;
  padding: ${space(2)};
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
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-auto-flow: column;
  justify-content: flex-end;
`;
