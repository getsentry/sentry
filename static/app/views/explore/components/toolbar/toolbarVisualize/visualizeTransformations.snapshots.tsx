import {IconAdd} from '@sentry/icons/add';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {OrganizationContext} from 'sentry/utils/organizationContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {AddTransformationButton} from './visualizeTransformations';

describe('AddTransformationButton', () => {
  it.snapshot.each([false, true])('disabled-%s', disabled => (
    <OrganizationContext value={OrganizationFixture()}>
      <Flex gap="md" align="baseline" padding="md">
        <Button icon={<IconAdd />} variant="link">
          Add Metric
        </Button>
        <Button disabled icon={<IconAdd />} variant="link">
          Add Equation
        </Button>
        <AddTransformationButton
          variant="link"
          traceItemDataset={TraceItemDataset.TRACEMETRICS}
          analyticsSource="dashboards"
          transformations={disabled ? ['fill(zero)', 'smooth(sma,3)'] : []}
          onChange={() => {}}
        />
      </Flex>
    </OrganizationContext>
  ));

  it.snapshot('icon-only', () => (
    <OrganizationContext value={OrganizationFixture()}>
      <Flex padding="md">
        <AddTransformationButton
          iconOnly
          traceItemDataset={TraceItemDataset.TRACEMETRICS}
          transformations={[]}
          onChange={() => {}}
        />
      </Flex>
    </OrganizationContext>
  ));
});
