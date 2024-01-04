import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Sql} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/sql';

describe('Breadcrumb Data SQL', function () {
  const {organization, router} = initializeOrg({
    router: {
      location: {query: {project: '0'}},
    },
  });

  it('displays formatted SQL message', function () {
    const message = `
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
UPDATE NOWAIT`;
    render(<Sql searchTerm="" message={message} />, {organization, router});

    expect(screen.getByText('SELECT db.id, db.project_id,')).toBeInTheDocument();
    expect(screen.getByText('ORDER BY db.id ASC')).toBeInTheDocument();
  });
});
