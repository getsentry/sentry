import {Fragment} from 'react';

import {ProjectList} from 'sentry/components/projectList';
import * as Storybook from 'sentry/stories';

const PROJECT_SLUGS = ['sentry', 'javascript', 'snuba', 'seer'];

export default Storybook.story('ProjectList', story => {
  story('Configuring the number of visible projects', () => (
    <Fragment>
      <p>
        The number of visible projects is configurable with the{' '}
        <Storybook.JSXProperty name="maxVisibleProjects" value /> prop.
      </p>
      <p>The default is 2.</p>
      <Storybook.PropMatrix
        propMatrix={{
          maxVisibleProjects: [1, 2, 3, 4],
        }}
        render={props => <ProjectList {...props} projectSlugs={PROJECT_SLUGS} />}
        selectedProps={['maxVisibleProjects']}
      />
    </Fragment>
  ));

  story('Custom tooltip', () => (
    <Fragment>
      <p>
        The tooltip text is also configurable with the{' '}
        <Storybook.JSXProperty name="collapsedProjectsTooltip" value /> prop.
      </p>
      <ProjectList
        projectSlugs={PROJECT_SLUGS}
        collapsedProjectsTooltip={projects => (
          <div>
            Look at all my other projects!
            <ul>
              {projects.map(project => (
                <li key={project.slug}>{project.slug}</li>
              ))}
            </ul>
          </div>
        )}
      />
    </Fragment>
  ));
});
