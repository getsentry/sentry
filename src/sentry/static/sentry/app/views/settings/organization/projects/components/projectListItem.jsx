import styled from 'react-emotion';
import LazyLoad from 'react-lazy-load';
import React from 'react';

import {update} from '../../../../../actionCreators/projects';
import ApiMixin from '../../../../../mixins/apiMixin';
import TooltipMixin from '../../../../../mixins/tooltip';
import BarChart from '../../../../../components/barChart';
import Link from '../../../../../components/link';
import ProjectLabel from '../../../../../components/projectLabel';
import SentryTypes from '../../../../../proptypes';

const StyledChartCell = styled.td`
  text-align: right;
  justify-content: flex-end;
  width: 200px;
`;

const ProjectListItem = React.createClass({
  propTypes: {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
  },

  mixins: [
    ApiMixin,
    TooltipMixin(function() {
      return {
        selector: '.tip',
        title: function(instance) {
          return this.getAttribute('data-isbookmarked') === 'true'
            ? 'Remove from bookmarks'
            : 'Add to bookmarks';
        },
      };
    }),
  ],

  getInitialState() {
    return {
      bookmarked: null,
    };
  },

  componentWillReceiveProps(nextProps) {
    // Local bookmarked state should be unset when the project data changes
    // Local state is used for optimistic UI update
    if (nextProps.project.isBookmarked !== this.props.project.isBookmarked) {
      this.setState({bookmarked: null});
    }
  },

  toggleBookmark() {
    let {project, organization} = this.props;

    this.setState({bookmarked: !project.isBookmarked}, () =>
      update(this.api, {
        orgId: organization.slug,
        projectId: project.slug,
        data: {
          isBookmarked: !project.isBookmarked,
        },
      })
    );
  },

  render() {
    let {project, organization} = this.props;
    let org = organization;
    let chartData =
      project.stats &&
      project.stats.map(point => {
        return {x: point[0], y: point[1]};
      });
    let isBookmarked = this.state.bookmarked || project.isBookmarked;

    return (
      <tr key={project.id} className={isBookmarked ? 'isBookmarked' : null}>
        <td>
          <h5>
            <a
              onClick={this.toggleBookmark}
              className="tip"
              data-isbookmarked={isBookmarked}
            >
              {isBookmarked ? (
                <span className="icon-star-solid bookmark" />
              ) : (
                <span className="icon-star-outline bookmark" />
              )}
            </a>
            <Link to={`/settings/organization/${org.slug}/project/${project.slug}/`}>
              <ProjectLabel project={project} organization={this.props.organization} />
            </Link>
          </h5>
        </td>

        <StyledChartCell>
          {chartData && (
            <LazyLoad>
              <BarChart height={20} points={chartData} label="events" />
            </LazyLoad>
          )}
        </StyledChartCell>
      </tr>
    );
  },
});

export default ProjectListItem;
