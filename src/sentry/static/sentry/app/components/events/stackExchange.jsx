import React from 'react';
import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import Count from 'app/components/count';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';

class EventStackExchange extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    event: SentryTypes.Event.isRequired,
  };

  state = {
    questions: [],
    loading: true,
  };

  // eslint-disable-next-line react/sort-comp
  _isMounted = false;

  componentDidMount() {
    this._isMounted = true;

    this.fetchData();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  fetchData = () => {
    const {api, project, organization, event} = this.props;

    this.setState({
      loading: true,
    });

    api.request(
      `/projects/${organization.slug}/${project.slug}/events/${event.id}/stackexchange/`,
      {
        success: data => {
          if (!this._isMounted) {
            return;
          }

          this.setState({
            questions: data.items,
            loading: false,
          });
        },
        error: err => {
          // TODO: refactor this
          console.log('oh crap its broken');
          console.log(err);

          this.setState({
            loading: false,
            questions: [],
            error: err,
          });
        },
      }
    );
  };

  renderHeaders() {
    return (
      <Sticky>
        <StyledFlex py={1}>
          <Box w={16} mx={2} className="align-right">
            <object
              type="image/svg+xml"
              width="20"
              height="20"
              data="https://cdn.sstatic.net/Sites/stackoverflow/company/img/logos/so/so-icon.svg?v=f13ebeedfa9e"
            />
          </Box>
          <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
            <ToolbarHeader>{t('Question')}</ToolbarHeader>
          </Box>
          <Box w={16} mx={2} className="align-right" />
          <Box w={[40, 60, 80, 80]} mx={2} className="align-right">
            <ToolbarHeader>{t('Answers')}</ToolbarHeader>
          </Box>
          <Box w={[40, 60, 80, 80]} mx={2} className="align-right">
            <ToolbarHeader>{t('Views')}</ToolbarHeader>
          </Box>
        </StyledFlex>
      </Sticky>
    );
  }

  decode(escapedHtml) {
    const doc = new DOMParser().parseFromString(escapedHtml, 'text/html');
    return doc.documentElement.textContent;
  }

  renderStackExchangeQuestion = question => {
    return (
      <Group key={question.question_id} py={1} px={0} align="center">
        <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
          <div>
            <a href={question.link} target="_blank" rel="noopener noreferrer">
              {this.decode(question.title)}
            </a>
          </div>
          <StyledTags>
            {question.tags.map(tag => (
              <a style={{cursor: 'default'}} className="btn btn-default btn-sm" key={tag}>
                {tag}
              </a>
            ))}
          </StyledTags>
        </Box>
        <Flex w={16} mx={2} justify="flex-end">
          {question.is_answered && <span className="icon-checkmark" />}
        </Flex>
        <Flex w={[40, 60, 80, 80]} mx={2} justify="flex-end">
          <StyledCount value={question.answer_count} />
        </Flex>
        <Flex w={[40, 60, 80, 80]} mx={2} justify="flex-end">
          <StyledCount value={question.view_count} />
        </Flex>
      </Group>
    );
  };

  renderAskOnStackOverflow() {
    const {title, platform} = this.props.event;

    return (
      <a
        className="btn btn-default btn-sm"
        href={`https://stackoverflow.com/questions/ask?tags=${platform}&title=${encodeURIComponent(
          title
        )}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        Don't see your issue? Ask on Stackoverflow!
      </a>
    );
  }

  renderSeeMoreResults() {
    const {title, platform} = this.props.event;

    const query = `[${platform}] ${title}`;

    return (
      <a
        className="btn btn-default btn-sm"
        href={`https://stackoverflow.com/search?q=${encodeURIComponent(query)}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        See more results
      </a>
    );
  }

  render() {
    if (this.state.loading) {
      return null;
    }

    if (this.state.questions.length <= 0) {
      return null;
    }

    const top3 = this.state.questions.slice(0, 3);

    return (
      <div className="extra-data box">
        <div className="box-header">
          <h3>StackExchange</h3>
          <Panel>
            {this.renderHeaders()}
            <PanelBody>{top3.map(this.renderStackExchangeQuestion)}</PanelBody>
          </Panel>
          <ButtonListControls>
            {this.renderAskOnStackOverflow()}
            {this.renderSeeMoreResults()}
          </ButtonListControls>
        </div>
      </div>
    );
  }
}

const Group = styled(PanelItem)`
  line-height: 1.1;
`;

const Sticky = styled('div')`
  position: sticky;
  z-index: ${p => p.theme.zIndex.header};
  top: -1px;
`;

const StyledFlex = styled(Flex)`
  align-items: center;
  background: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  margin-bottom: -1px;
`;

const StyledCount = styled(Count)`
  font-size: 18px;
  color: ${p => p.theme.gray3};
`;

const ButtonList = styled('div')`
  > * + * {
    margin-left: ${space(1)};
  }
`;

const StyledTags = styled(ButtonList)`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

const ButtonListControls = styled(ButtonList)`
  margin-top: -${space(1)};
  margin-bottom: ${space(3)};
`;

export default withApi(EventStackExchange);
