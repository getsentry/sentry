import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {
  type AttributesFieldRendererProps,
  AttributesTree,
} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function ProviderWrapper({children}: {children?: React.ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('attributesTree', () => {
  const organization = OrganizationFixture({
    features: ['trace-view-v1'],
  });

  const location = LocationFixture();

  const theme = ThemeFixture();

  beforeEach(function () {
    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('correctly renders attributes tree', () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: 'test value 1',
        name: 'test.attribute1',
      } as TraceItemResponseAttribute,
      {
        type: 'float',
        value: 42,
        name: 'test.attribute2',
      } as TraceItemResponseAttribute,
      {
        type: 'bool',
        value: true,
        name: 'test.attribute3',
      } as TraceItemResponseAttribute,
    ];

    const renderers = {
      'test.attribute2': (props: AttributesFieldRendererProps<RenderFunctionBaggage>) => {
        return <div>custom.renderered.value: {props.item.value}</div>;
      },
    };

    const getAdjustedAttributeKey = (attribute: TraceItemResponseAttribute) => {
      if (attribute.name === 'test.attribute1') {
        return 'test.attribute1-adjusted';
      }
      return attribute.name;
    };

    render(
      <ProviderWrapper>
        <AttributesTree
          attributes={attributes}
          getAdjustedAttributeKey={getAdjustedAttributeKey}
          renderers={renderers}
          rendererExtra={{
            theme,
            location,
            organization,
          }}
        />
      </ProviderWrapper>
    );

    // check rendered values
    expect(screen.getByText('test value 1')).toBeInTheDocument();
    expect(screen.getByText('custom.renderered.value: 42')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();

    // check rendered keys
    expect(screen.getByTestId('tree-key-test.attribute1-adjusted')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-test.attribute1-adjusted')).toHaveTextContent(
      'attribute1'
    );
    expect(screen.getByTestId('tree-key-test.attribute2')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-test.attribute2')).toHaveTextContent(
      'attribute2'
    );
    expect(screen.getByTestId('tree-key-test.attribute3')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-test.attribute3')).toHaveTextContent(
      'attribute3'
    );
  });

  it('correctly renders cell actions', async () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: 'test value 1',
        name: 'test.attribute1',
      } as TraceItemResponseAttribute,
      {
        type: 'str',
        value: 'test value 2',
        name: 'test',
      } as TraceItemResponseAttribute,
      {
        type: 'str',
        value: 'test value 3',
        name: 'test.some-inner-thing.value',
      } as TraceItemResponseAttribute,
    ];

    render(
      <ProviderWrapper>
        <AttributesTree
          attributes={attributes}
          rendererExtra={{
            theme,
            location,
            organization,
          }}
          getCustomActions={content => {
            if (!content.originalAttribute) {
              return [];
            }

            const items: MenuItemProps[] = [
              {
                key: 'visible action',
                label: 'Visible Action',
                onAction: () => null,
              },
              {
                key: 'hidden-action',
                label: 'Hidden Action',
                hidden: true,
                onAction: () => null,
              },
              {
                key: 'disabled-action',
                label: 'Disabled Action',
                disabled: true,
                onAction: () => null,
              },
            ];

            return items;
          }}
        />
      </ProviderWrapper>
    );

    const allTreeRows = await screen.findAllByTestId('attribute-tree-row');
    expect(allTreeRows.length).toBeGreaterThan(0);
    for (const row of allTreeRows) {
      // test, test.row, test.deeply.nested.attribute
      await userEvent.hover(row);
      const actionsButton = within(row).queryByRole('button', {
        name: 'Attribute Actions Menu',
      });
      if (actionsButton === null) {
        expect(row?.textContent).toBe('some-inner-thing');
        continue;
      }
      await userEvent.click(actionsButton);
      expect(await within(row).findByText('Visible Action')).toBeInTheDocument();
      expect(await within(row).findByText('Disabled Action')).toBeInTheDocument();
      expect(within(row).queryByText('Hidden Action')).not.toBeInTheDocument();
    }
  });
});
