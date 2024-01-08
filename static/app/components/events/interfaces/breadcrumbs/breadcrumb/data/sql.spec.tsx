import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Sql} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/sql';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

describe('Breadcrumb Data SQL', function () {
  const {organization, router} = initializeOrg({
    router: {
      location: {query: {project: '0'}},
    },
  });

  it('displays formatted SQL message', function () {
    render(
      <Sql
        breadcrumb={{
          type: BreadcrumbType.WARNING,
          level: BreadcrumbLevelType.WARNING,
          message: `
SELECT db.id, db.project_id,
       db.release_name, db.dist_name,
       db.date_added
FROM db
WHERE (db.dist_name = %s
       AND db.project_id = %s
       AND db.release_name = %s)
ORDER BY db.id ASC
LIMIT 1
FOR
UPDATE NOWAIT`,
        }}
        searchTerm=""
        meta={
          {
            // data: {
            //   url: {
            //     '': {
            //       rem: [['project:0', 's', 0, 0]],
            //       len: 19,
            //       chunks: [
            //         {
            //           type: 'redaction',
            //           text: '',
            //           rule_id: 'project:0',
            //           remark: 's',
            //         },
            //       ],
            //     },
            //   },
            // },
          }
        }
      />,
      {organization, router}
    );

    expect(screen.getByText('SELECT db.id, db.project_id,')).toBeInTheDocument();
    expect(screen.getByText('ORDER BY db.id ASC')).toBeInTheDocument();
  });

  it('normalizes the message when annotatedText is present', function () {
    render(
      <Sql
        breadcrumb={{
          type: BreadcrumbType.WARNING,
          level: BreadcrumbLevelType.WARNING,
          message: 'Text...',
        }}
        searchTerm=""
        meta={{
          message: {
            '': {
              len: 2,
              chunks: [
                {
                  type: 'redaction',
                  text: '...',
                  rule_id: '!limit',
                  remark: 'x',
                },
              ],
            },
          },
        }}
      />,
      {organization, router}
    );

    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.queryByText('Text...')).not.toBeInTheDocument();
  });
});
