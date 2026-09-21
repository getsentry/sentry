import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

import {WidgetType} from 'sentry/views/dashboards/types';

import {getMenuOptions} from './widgetCardContextMenu';

describe('widget monitor submenu', () => {
  it.each(['short-query', 'a-very-long-query-name-'.repeat(20)])(
    'caps labels while preserving the full name and monitor link (%s)',
    async queryName => {
      const organization = OrganizationFixture();
      const widget = WidgetFixture({
        widgetType: WidgetType.SPANS,
        queries: [
          WidgetQueryFixture({
            name: queryName,
            aggregates: ['count()'],
            columns: [],
            fields: ['count()'],
          }),
        ],
      });
      const items = getMenuOptions(
        undefined,
        organization,
        PageFiltersFixture(),
        widget,
        false,
        true,
        LocationFixture(),
        undefined,
        undefined,
        undefined,
        [{seriesName: `${queryName} : count()`, data: [{name: '2026-09-21', value: 1}]}]
      );
      const label = `${queryName} : count()`;

      render(<DropdownMenu items={items} triggerLabel="Widget actions" />, {
        organization,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Widget actions'}));
      await userEvent.hover(
        screen.getByRole('menuitemradio', {name: 'Create a Monitor for'})
      );

      const menuItem = await screen.findByRole('menuitemradio', {name: label});
      expect(menuItem).toHaveAttribute(
        'href',
        expect.stringContaining('aggregate=count')
      );
      const labelElement = within(menuItem).getByText(label);
      expect(labelElement).toHaveStyle({maxWidth: '300px'});
      expect(getEmotionRules(labelElement).join('')).toContain('text-overflow: ellipsis');
      expect(
        items.find(item => item.key === 'create-alert')?.children?.[0]?.textValue
      ).toBe(label);

      await userEvent.hover(menuItem);
      expect(
        await screen.findByText(label, {selector: '[data-tooltip]'})
      ).toBeInTheDocument();
    }
  );
});
