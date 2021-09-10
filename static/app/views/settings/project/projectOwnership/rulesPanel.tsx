import * as React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import FeatureBadge from 'app/components/featureBadge';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {IconGithub, IconGitlab, IconSentry} from 'app/icons';
import {inputStyles} from 'app/styles/input';
import space from 'app/styles/space';

type Props = {
  raw: string;
  dateUpdated: string | null;
  provider?: string;
  repoName?: string;
  type: 'codeowners' | 'issueowners';
  placeholder?: string;
  controls?: React.ReactNode[];
  'data-test-id': string;
};

type State = {};

class RulesPanel extends React.Component<Props, State> {
  renderIcon(provider: string) {
    switch (provider) {
      case 'github':
        return <IconGithub size="md" />;
      case 'gitlab':
        return <IconGitlab size="md" />;
      default:
        return <IconSentry size="md" />;
    }
  }
  renderTitle() {
    switch (this.props.type) {
      case 'codeowners':
        return 'CODEOWNERS';
      case 'issueowners':
        return 'Ownership Rules';
      default:
        return null;
    }
  }

  render() {
    const {
      raw,
      dateUpdated,
      provider,
      repoName,
      placeholder,
      controls,
      ['data-test-id']: dataTestId,
    } = this.props;
    return (
      <Panel data-test-id={dataTestId}>
        <PanelHeader>
          {[
            <Container key="title">
              {this.renderIcon(provider ?? '')}
              <Title>{this.renderTitle()}</Title>
              {repoName && <Repository>{`- ${repoName}`}</Repository>}
              <FeatureBadge type="new" />
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
}

export default withTheme(RulesPanel);

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
  grid-gap: ${space(1)};
  grid-auto-flow: column;
  justify-content: flex-end;
`;
