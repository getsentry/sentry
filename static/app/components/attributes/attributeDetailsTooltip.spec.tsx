import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AttributeDetailsTooltip} from 'sentry/components/attributes/attributeDetailsTooltip';
import {ConfigStore} from 'sentry/stores/configStore';
import {FieldValueType} from 'sentry/utils/fields';

describe('AttributeDetailsTooltip', () => {
  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  it.each([
    ['logger.name', 'Public'],
    ['sentry.dsc.sampled', 'Internal'],
    ['checkout.cart_size', 'Public'],
  ])('shows staff the visibility of %s', async (attributeKey, visibility) => {
    ConfigStore.set('user', UserFixture({isStaff: true, isSuperuser: false}));
    render(
      <AttributeDetailsTooltip attributeKey={attributeKey} fieldDefinitionType="log" />
    );

    await userEvent.hover(screen.getByText(attributeKey));

    expect(await screen.findByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText(visibility)).toBeInTheDocument();
  });

  it.each(['logger.name', 'sentry.dsc.sampled'])(
    'omits visibility for non-staff viewing %s, even in superuser mode',
    async attributeKey => {
      ConfigStore.set('user', UserFixture({isStaff: false, isSuperuser: true}));
      render(
        <AttributeDetailsTooltip attributeKey={attributeKey} fieldDefinitionType="log" />
      );

      await userEvent.hover(screen.getByText(attributeKey));

      expect(await screen.findByText('Description')).toBeInTheDocument();
      expect(screen.queryByText('Visibility')).not.toBeInTheDocument();
      expect(screen.queryByText('Public')).not.toBeInTheDocument();
      expect(screen.queryByText('Internal')).not.toBeInTheDocument();
    }
  );

  it('keeps internal visibility when the displayed name is public', async () => {
    ConfigStore.set('user', UserFixture({isStaff: true}));
    render(
      <AttributeDetailsTooltip
        attributeKey="sentry.dsc.environment"
        name="environment"
        fieldDefinitionType="log"
      />
    );

    await userEvent.hover(screen.getByText('environment'));

    expect(await screen.findByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();
  });

  it('describes the attribute when hovering its name', async () => {
    render(
      <AttributeDetailsTooltip attributeKey="logger.name" fieldDefinitionType="log" />
    );

    await userEvent.hover(screen.getByText('logger.name'));

    expect(await screen.findByText('string')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(
      screen.getByText('The name of the logger that generated this event.')
    ).toBeInTheDocument();
    expect(screen.getByText('Added by Sentry')).toBeInTheDocument();
  });

  it('renders the name underlined so it reads as something to hover', () => {
    render(
      <AttributeDetailsTooltip attributeKey="logger.name" fieldDefinitionType="log" />
    );

    expect(screen.getByText('logger.name')).toHaveStyle({
      textDecorationStyle: 'dotted',
    });
  });

  it('renders only the children inline when they are given', async () => {
    render(
      <AttributeDetailsTooltip
        attributeKey="tags[code.line.number,number]"
        fieldDefinitionType="log"
        name="code.line.number"
      >
        number
      </AttributeDetailsTooltip>
    );

    expect(screen.getByText('number')).toBeInTheDocument();
    expect(screen.queryByText('code.line.number')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('number'));

    expect(await screen.findByText('code.line.number')).toBeInTheDocument();
    expect(screen.getByText('integer')).toBeInTheDocument();
  });

  it('finds the definition when the key is prefixed but the name is not', async () => {
    render(
      <AttributeDetailsTooltip
        attributeKey="sentry.logger.name"
        fieldDefinitionType="log"
        name="logger.name"
      />
    );

    await userEvent.hover(screen.getByText('logger.name'));

    expect(
      await screen.findByText('The name of the logger that generated this event.')
    ).toBeInTheDocument();
    expect(screen.getByText('Added by Sentry')).toBeInTheDocument();
  });

  it('describes an unknown attribute as a tag and credits nobody', async () => {
    render(
      <AttributeDetailsTooltip
        attributeKey="my.custom.attribute"
        defaultValueType={FieldValueType.BOOLEAN}
        fieldDefinitionType="log"
      />
    );

    await userEvent.hover(screen.getByText('my.custom.attribute'));

    expect(await screen.findByText('boolean')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('A tag sent with one or more events')).toBeInTheDocument();
    expect(screen.queryByText('Added by Sentry')).not.toBeInTheDocument();
  });

  it('notes the value was scrubbed when the attribute is scrubbed', async () => {
    render(
      <AttributeDetailsTooltip
        attributeKey="user.email"
        fieldDefinitionType="log"
        isScrubbed
      />
    );

    await userEvent.hover(screen.getByText('user.email'));

    expect(await screen.findByText('Data scrubbed for privacy')).toBeInTheDocument();
  });

  it('omits the scrubbing note when the attribute is not scrubbed', async () => {
    render(
      <AttributeDetailsTooltip attributeKey="user.email" fieldDefinitionType="log" />
    );

    await userEvent.hover(screen.getByText('user.email'));

    expect(await screen.findByText('Description')).toBeInTheDocument();
    expect(screen.queryByText('Data scrubbed for privacy')).not.toBeInTheDocument();
  });
});
