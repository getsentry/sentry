import * as React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import Tag from 'app/components/tag';
import {IconGithub, IconGitlab, IconSentry} from 'app/icons';
import {inputStyles} from 'app/styles/input';
import space from 'app/styles/space';

type Props = {
  raw: string;
  dateUpdated: string | null;
  provider?: string;
  repoName?: string;
  readOnly?: boolean;
  type: 'codeowners' | 'issueowners';
  placeholder?: string;
  detail?: React.ReactNode;
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
      readOnly,
      placeholder,
      detail,
      controls,
      ['data-test-id']: dataTestId,
    } = this.props;
    return (
      <Container data-test-id={dataTestId}>
        <RulesHeader>
          <TitleContainer>
            {this.renderIcon(provider ?? '')}
            <Title>{this.renderTitle()}</Title>
          </TitleContainer>
          {readOnly && <ReadOnlyTag type="default">{'Read Only'}</ReadOnlyTag>}
          {repoName && <Repository>{repoName}</Repository>}
          {detail && <Detail>{detail}</Detail>}
        </RulesHeader>
        <RulesView>
          <InnerPanel>
            <InnerPanelHeader>
              <SyncDate>
                {dateUpdated && `Last synced ${moment(dateUpdated).fromNow()}`}
              </SyncDate>
              <Controls>
                {(controls || []).map((c, n) => (
                  <span key={n}> {c}</span>
                ))}
              </Controls>
            </InnerPanelHeader>
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
          </InnerPanel>
        </RulesView>
      </Container>
    );
  }
}

export default withTheme(RulesPanel);

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr 2fr;
  grid-template-areas: 'rules-header rules-view';
  margin-bottom: ${space(3)};
`;

const RulesHeader = styled('div')`
  grid-area: rules-header;
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 45px 1fr 1fr 1fr 1fr;
  grid-template-areas: 'title tag' 'repository repository' '. .' '. .' 'detail detail';
  border: 1px solid ${p => p.theme.border};
  border-radius: 4px 0 0 4px;
  border-right: none;
  box-shadow: 0 2px 0 rgb(37 11 54 / 4%);
  background-color: ${p => p.theme.background};
`;
const TitleContainer = styled('div')`
  grid-area: title;
  align-self: center;
  padding-left: ${space(2)};
  display: flex;
  * {
    padding-right: ${space(0.5)};
  }
`;
const Title = styled('div')`
  align-self: center;
`;
const ReadOnlyTag = styled(Tag)`
  grid-area: tag;
  align-self: center;
  justify-self: end;
  padding-right: ${space(1)};
`;
const Repository = styled('div')`
  grid-area: repository;
  padding-left: calc(${space(2)} + ${space(3)});
  color: ${p => p.theme.textColor};
  font-size: 14px;
`;
const Detail = styled('div')`
  grid-area: detail;
  align-self: end;
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
  color: ${p => p.theme.textColor};
  font-size: 14px;
  line-height: 1.4;
`;

const RulesView = styled('div')`
  grid-area: rules-view;
`;

const InnerPanel = styled(Panel)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0px;
  margin: 0px;
  height: 100%;
`;

const InnerPanelHeader = styled(PanelHeader)`
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-areas: 'sync-date controis';
  text-transform: none;
  font-size: 16px;
  font-weight: 400;
`;

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
  grid-area: sync-date;
`;
const Controls = styled('div')`
  display: grid;
  align-items: center;
  grid-gap: ${space(1)};
  grid-auto-flow: column;
  justify-content: flex-end;
`;
