import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';

import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

import {AttributesTree, type AttributesFieldRendererProps} from './attributesTree';

describe('attributesTree', () => {
  const organization = OrganizationFixture();

  const location = LocationFixture();

  const theme = ThemeFixture();

  it.each([
    ['sentry.logger.name', 'logger.name'],
    ['log.custom.name', 'custom.name'],
    ['tags[sentry.custom,number]', 'custom'],
    ['tags[message,string]', 'message'],
  ])('gates display normalization for %s', (name, legacyName) => {
    const attributes: TraceItemResponseAttribute[] = [
      {name, type: 'str', value: 'test value'},
    ];
    const rendererExtra = {theme, location, navigate: jest.fn(), organization};
    const {rerender} = render(
      <AttributesTree attributes={attributes} rendererExtra={rendererExtra} />
    );

    expect(screen.getByTitle(legacyName)).toBeInTheDocument();
    expect(screen.getByText('test value')).toBeInTheDocument();

    rerender(
      <AttributesTree
        attributes={attributes}
        rendererExtra={{
          ...rendererExtra,
          organization: OrganizationFixture({
            features: ['trace-item-details-raw-attribute-names'],
          }),
        }}
      />
    );

    expect(screen.getByTitle(name)).toBeInTheDocument();
    expect(screen.queryByTitle(legacyName)).not.toBeInTheDocument();
    expect(screen.getByText('test value')).toBeInTheDocument();
  });

  it('preserves raw keys in tooltips and scrubbing metadata with the flag enabled', async () => {
    const rawOrganization = OrganizationFixture({
      features: ['trace-item-details-raw-attribute-names'],
    });
    render(
      <AttributesTree
        attributes={[{name: 'sentry.project_id', type: 'str', value: '[Filtered]'}]}
        getAdjustedAttributeKey={() => 'project.id'}
        config={{attributeDetailsType: 'log'}}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization: rawOrganization,
          traceItemMeta: {
            'sentry.project_id': {
              meta: {value: {'': {len: 10, rem: [['!config', 's']]}}},
            },
          },
        }}
      />,
      {organization: rawOrganization}
    );

    await userEvent.hover(screen.getByText('project_id'));

    expect(await screen.findByText('Data scrubbed for privacy')).toBeInTheDocument();
    expect(screen.getByText('project_id')).toHaveAccessibleDescription(
      expect.stringContaining('sentry.project_id')
    );
    expect(screen.queryByText('project.id')).not.toBeInTheDocument();
    expect(screen.getByText('[Filtered]')).toBeInTheDocument();
  });

  it.each<TraceItemResponseAttribute>([
    {name: 'retry_count', queryName: 'tags[retry_count,number]', type: 'int', value: 42},
    {name: 'enabled', queryName: 'tags[enabled,boolean]', type: 'bool', value: true},
    {name: 'trace', queryName: 'tags[trace,string]', type: 'str', value: 'custom'},
    {name: 'sentry.trace_id', queryName: 'trace', type: 'str', value: 'trace-id'},
    {name: 'labels', queryName: 'tags[labels,array]', type: 'array', value: ['one']},
  ])(
    'uses the query name for actions on $name without changing its display',
    async attribute => {
      render(
        <AttributesTree
          attributes={[attribute]}
          pinnedAttribute={attribute.queryName}
          rendererExtra={{
            theme,
            location,
            navigate: jest.fn(),
            organization: OrganizationFixture({
              features: ['trace-item-details-raw-attribute-names'],
            }),
          }}
          getCustomActions={content => [
            {key: 'query', label: content.original!.original_attribute_key},
          ]}
        />
      );

      expect(screen.getByTitle(attribute.name)).toBeInTheDocument();
      expect(screen.getByRole('img', {name: 'Pinned attribute'})).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', {name: 'Attribute Actions Menu'}),
        {
          pointerEventsCheck: 0,
        }
      );
      expect(
        screen.getByRole('menuitemradio', {name: attribute.queryName})
      ).toBeInTheDocument();
    }
  );

  it('correctly renders attributes tree', () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: 'test value 1',
        name: 'test.attribute1',
      },
      {
        type: 'float',
        value: 42,
        name: 'test.attribute2',
      },
      {
        type: 'bool',
        value: true,
        name: 'test.attribute3',
      },
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
      <AttributesTree
        attributes={attributes}
        getAdjustedAttributeKey={getAdjustedAttributeKey}
        renderers={renderers}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
      />
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
      },
      {
        type: 'str',
        value: 'test value 2',
        name: 'test',
      },
      {
        type: 'str',
        value: 'test value 3',
        name: 'test.some-inner-thing.value',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
        getCustomActions={content => {
          if (!content.original) {
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
      // jsdom does not evaluate :hover styles, so bypass the hidden action's pointer-events check.
      await userEvent.click(actionsButton, {pointerEventsCheck: 0});
      expect(await within(row).findByText('Visible Action')).toBeInTheDocument();
      expect(await within(row).findByText('Disabled Action')).toBeInTheDocument();
      expect(within(row).queryByText('Hidden Action')).not.toBeInTheDocument();
    }
  });

  it('renders an array attribute and types it as array in its details', async () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'array',
        value: ['timestamp', 'message'],
        name: 'tags[csv_headers,array]',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        config={{attributeDetailsType: 'log'}}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
      />
    );

    expect(screen.getByTestId('attribute-tree-row')).toHaveTextContent(
      '[timestamp,message]'
    );

    await userEvent.hover(
      within(screen.getByTestId('tree-key-tags[csv_headers,array]')).getByText(
        'csv_headers'
      )
    );

    expect(await screen.findByText('array')).toBeInTheDocument();
  });

  it.each([
    {features: [], expectedKey: 'span.op'},
    {
      features: ['trace-item-details-raw-attribute-names'],
      expectedKey: 'sentry.op',
    },
  ])(
    'describes $expectedKey when an attribute details type is given',
    async ({features, expectedKey}) => {
      const attributes: TraceItemResponseAttribute[] = [
        {
          type: 'str',
          value: 'http.client',
          name: 'sentry.op',
        },
      ];

      render(
        <AttributesTree
          attributes={attributes}
          config={{attributeDetailsType: 'span'}}
          getAdjustedAttributeKey={() => 'span.op'}
          rendererExtra={{
            theme,
            location,
            navigate: jest.fn(),
            organization: OrganizationFixture({features}),
          }}
        />,
        {organization: OrganizationFixture({features})}
      );

      await userEvent.hover(
        within(screen.getByTestId(`tree-key-${expectedKey}`)).getByText('op')
      );

      expect(await screen.findByText('The operation of a span.')).toBeInTheDocument();
      expect(screen.getByText('Added by Sentry')).toBeInTheDocument();
    }
  );

  it('notes an attribute was scrubbed when its trace item meta carries a remark', async () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: '[Filtered]',
        name: 'user.email',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        config={{attributeDetailsType: 'log'}}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
          traceItemMeta: {
            'user.email': {
              meta: {value: {'': {len: 10, rem: [['@email', 's', 0, 10]]}}},
            },
          },
        }}
      />
    );

    await userEvent.hover(
      within(screen.getByTestId('tree-key-user.email')).getByText('email')
    );

    expect(await screen.findByText('Data scrubbed for privacy')).toBeInTheDocument();
  });

  it('falls back to a plain browser tooltip when no attribute details type is given', () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: 'sentry.python',
        name: 'sentry.logger.name',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
      />
    );

    expect(screen.getByTitle('logger.name')).toContainElement(
      screen.getByTestId('tree-key-sentry.logger.name')
    );
  });
});
