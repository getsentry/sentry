import styled from 'react-emotion';
import React from 'react';
import createReactClass from 'create-react-class';

import ApiMixin from 'app/mixins/apiMixin';

import BookmarkStar from 'app/components/bookmarkStar';
import Link from 'app/components/link';
import ProjectLabel from 'app/components/projectLabel';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

const ProjectItem = createReactClass({
  displayName: 'ProjectItem',

  propTypes: {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
  },

  mixins: [ApiMixin],

  render() {
    const {project, organization} = this.props;

    const hasNewRoutes = new Set(organization.features).has('sentry10');

    return (
      <Container key={project.id}>
        <BookmarkLink organization={organization} project={project} />
        <Link
          to={
            hasNewRoutes
              ? `/settings/${organization.slug}/projects/${project.slug}/`
              : `/${organization.slug}/${project.slug}/`
          }
        >
          <ProjectLabel project={project} />
        </Link>
      </Container>
    );
  },
});

const Container = styled('div')`
  display: flex;
  align-items: center;
`;

const BookmarkLink = styled(BookmarkStar)`
  margin-right: ${space(1)};
  margin-top: -${space(0.25)};
`;

export default ProjectItem;
