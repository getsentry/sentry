import React from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types';
import $ from 'jquery';
import {Flex, Box} from 'grid-emotion';
import styled from 'react-emotion';

import Count from 'app/components/count';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';
import LoadingIndicator from 'app/components/loadingIndicator';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t} from 'app/locale';
import space from 'app/styles/space';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import {generateRequest} from './utils';
import {Sticky, StyledFlex} from './styles';

class StackExchangeResults extends React.PureComponent {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    query: PropTypes.string.isRequired,

    currentSite: PropTypes.shape({
      name: PropTypes.string.isRequired,
      api_site_parameter: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      site_url: PropTypes.string.isRequired,
    }).isRequired,
  };

  state = {
    questions: [],
    loading: true,
    error: null,
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
    const {query, event} = this.props;

    const params = {
      q: query,
      order: 'desc',
      sort: 'relevance',
      site: this.props.currentSite.api_site_parameter,
      tagged: event.platform,
    };

    const request = generateRequest({
      url: 'https://api.stackexchange.com/2.2/search/advanced',
      method: 'GET',
      params,
    });

    // We can't use the API client here since the URL is not scoped under the
    // API endpoints (which the client prefixes)
    $.ajax(request)
      .then(results => {
        if (!this._isMounted) {
          return;
        }

        this.setState({
          questions: results.items,
          loading: false,
          error: null,
        });
      })
      .fail(err => {
        if (!this._isMounted) {
          return;
        }

        this.setState({
          questions: [],
          loading: false,
          error: err,
        });
      });
  };

  renderHeaders() {
    return (
      <Sticky>
        <StyledFlex py={1}>
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
    const hasAcceptedAnswer = !!question.accepted_answer_id;

    // if there is an accepted answer, we link to it, otherwise, we link to the
    // stackoverflow question
    const question_link = hasAcceptedAnswer
      ? `${this.props.currentSite.site_url}/a/${question.accepted_answer_id}`
      : question.link;

    return (
      <Group key={question.question_id} py={1} px={0} align="center">
        <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
          <QuestionWrapper>
            {hasAcceptedAnswer && (
              <div style={{color: '#57be8c'}}>
                <span className="icon-checkmark" />
              </div>
            )}
            <a href={question_link} target="_blank" rel="noopener noreferrer">
              {this.decode(question.title)}
            </a>
          </QuestionWrapper>
          <StyledTags>
            {question.tags.map(tag => (
              <a
                className="btn btn-default btn-sm"
                key={tag}
                href={`${this.props.currentSite.site_url}/questions/tagged/${tag}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {tag}
              </a>
            ))}
          </StyledTags>
        </Box>
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
    const {query} = this.props;
    const {platform} = this.props.event;

    return (
      <a
        className="btn btn-default btn-sm"
        href={`${
          this.props.currentSite.site_url
        }/questions/ask?tags=${platform}&title=${encodeURIComponent(query)}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {t(`Don't see your issue? Ask on ${this.props.currentSite.name}!`)}
      </a>
    );
  }

  renderSeeMoreResults() {
    const {platform} = this.props.event;

    const query = `[${platform}] ${this.props.query}`;

    return (
      <a
        className="btn btn-default btn-sm"
        href={`${this.props.currentSite.site_url}/search?q=${encodeURIComponent(query)}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        See more results
      </a>
    );
  }

  renderBody = () => {
    const top3 = this.state.questions.slice(0, 3);

    if (this.state.loading) {
      return (
        <EmptyMessage>
          <LoadingIndicator mini>Loading</LoadingIndicator>
        </EmptyMessage>
      );
    }

    if (top3.length <= 0) {
      return <EmptyMessage>{t('No results')}</EmptyMessage>;
    }

    return <PanelBody>{top3.map(this.renderStackExchangeQuestion)}</PanelBody>;
  };

  render() {
    // if (!!this.state.error) {
    //   return null;
    // }

    return (
      <React.Fragment>
        <Panel>
          {this.renderHeaders()}
          {this.renderBody()}
        </Panel>
        <ButtonListControls>
          {this.renderAskOnStackOverflow()}
          {this.renderSeeMoreResults()}
        </ButtonListControls>
      </React.Fragment>
    );
  }
}

const QuestionWrapper = styled('div')`
  display: flex;
  align-items: center;

  padding-top: ${space(1)};
  padding-bottom: ${space(1)};

  > * + * {
    margin-left: ${space(1)};
  }
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

const Group = styled(PanelItem)`
  line-height: 1.1;
`;

export default StackExchangeResults;
