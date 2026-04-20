import {Button} from '@sentry/scraps/button';
import {Grid, Container} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {ErrorsToolbarGroupBy} from 'sentry/views/explore/errors/toolbar/errorsToolbarGroupBy';
import {ErrorsToolbarSortBy} from 'sentry/views/explore/errors/toolbar/errorsToolbarSortBy';
import {ErrorsToolbarVisualize} from 'sentry/views/explore/errors/toolbar/errorsToolbarVisualize';
import {SaveStyledToolbarSection} from 'sentry/views/explore/toolbar/toolbarSaveAs';

export function ErrorsToolbar() {
  return (
    <Container data-test-id="errors-toolbar">
      <ErrorsToolbarVisualize />
      <ErrorsToolbarGroupBy />
      <ErrorsToolbarSortBy />
      <ErrorsToolbarSaveAs />
    </Container>
  );
}

function ErrorsToolbarSaveAs() {
  return (
    <SaveStyledToolbarSection data-test-id="section-save-as">
      <Grid flow="column" align="center" gap="md">
        <Button aria-label={t('Save as')}>{t('Save')}</Button>
      </Grid>
    </SaveStyledToolbarSection>
  );
}
