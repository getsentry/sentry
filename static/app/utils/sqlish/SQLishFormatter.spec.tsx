import {Fragment} from 'react';

import {render} from 'sentry-test/reactTestingLibrary';

import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';

describe('SQLishFormatter', function () {
  describe('SQLishFormatter.toString()', () => {
    const formatter = new SQLishFormatter();

    it('Falls back to original string if unable to parse', () => {
      expect(formatter.toString('😤')).toBe('😤');
    });

    it('Adds newlines for keywords in SELECTs', () => {
      expect(formatter.toString('SELECT hello FROM users ORDER BY name DESC LIMIT 1;'))
        .toMatchInlineSnapshot(`
        "SELECT hello
        FROM users
        ORDER BY name DESC
        LIMIT 1;"
      `);
    });

    it('Adds newlines for keywords in INSERTs', () => {
      expect(
        formatter.toString('INSERT INTO users (id, name) VALUES (:c0, :c1) RETURNING *')
      ).toMatchInlineSnapshot(`
        "INSERT INTO users (id, name)
        VALUES (
          :c0, :c1
        )
        RETURNING *"
      `);
    });

    it('Adds indentation for keywords followed by parentheses', () => {
      expect(formatter.toString('SELECT * FROM (SELECT * FROM users))'))
        .toMatchInlineSnapshot(`
        "SELECT *
        FROM (
          SELECT *
          FROM users
        ))"
      `);
    });

    it('Capitalizes lowercase keywords', () => {
      expect(formatter.toString('select * from users;')).toMatchInlineSnapshot(`
        "SELECT *
        FROM users;"
      `);
    });

    it('Adds indentation for SELECTS in conditions', () => {
      expect(
        formatter.toString(
          'SELECT * FROM "sentry_users" WHERE (id IN (SELECT VO."id" FROM "sentry_vips" VO LIMIT 1)) AND (id IN (SELECT V1."id" FROM "sentry_currentusers" V1 LIMIT 1)) LIMIT 1'
        )
      ).toMatchInlineSnapshot(`
        "SELECT *
        FROM "sentry_users"
        WHERE (
          id IN (
            SELECT VO."id"
            FROM "sentry_vips" VO
            LIMIT 1
          )
        ) AND (id IN (
          SELECT V1."id"
          FROM "sentry_currentusers" V1
          LIMIT 1
        ))
        LIMIT 1"
      `);
    });

    it('Reflows long lines to a max length', () => {
      expect(
        formatter.toString(
          'SELECT "sentry_organization"."id", "sentry_organization"."name", "sentry_organization"."slug", "sentry_organization"."status", "sentry_organization"."date_added", "sentry_organization"."default_role", "sentry_organization"."is_test", "sentry_organization"."flags" FROM "sentry_organization" WHERE "sentry_organization"."id" = %s LIMIT 21'
        )
      ).toMatchInlineSnapshot(`
        "SELECT "sentry_organization"."id", "sentry_organization"."name", "sentry_organization"."slug",
          "sentry_organization"."status", "sentry_organization"."date_added",
          "sentry_organization"."default_role", "sentry_organization"."is_test", "sentry_organization"."flags"
        FROM "sentry_organization"
        WHERE "sentry_organization"."id" = %s
        LIMIT 21"
      `);
    });

    it('Reflows to specified width', () => {
      expect(
        formatter.toString(
          'SELECT "sentry_organization"."id", "sentry_organization"."name", "sentry_organization"."slug", "sentry_organization"."status", "sentry_organization"."date_added" FROM "sentry_organization" WHERE "sentry_organization"."id" = %s LIMIT 21',
          {maxLineLength: 40}
        )
      ).toMatchInlineSnapshot(`
        "SELECT "sentry_organization"."id",
          "sentry_organization"."name",
          "sentry_organization"."slug",
          "sentry_organization"."status",
          "sentry_organization"."date_added"
        FROM "sentry_organization"
        WHERE "sentry_organization"."id" = %s
        LIMIT 21"
      `);
    });

    it('Reflows avoid unnecessary newlines', () => {
      expect(
        formatter.toString(
          'SELECT "sentry_team"."org_role" FROM "sentry_team" INNER JOIN "sentry_organizationmember_teams" ON ("sentry_team"."id" = "sentry_organizationmember_teams"."team_id" WHERE ( "sentry_organizationmember_teams"."organizationmember_id" = %s AND NOT ("sentry_team"."org_role" IS NULL)'
        )
      ).toMatchInlineSnapshot(`
        "SELECT "sentry_team"."org_role"
        FROM "sentry_team"
        INNER JOIN "sentry_organizationmember_teams" ON ("sentry_team"."id" =
          "sentry_organizationmember_teams"."team_id"
        WHERE (
           "sentry_organizationmember_teams"."organizationmember_id" = %s AND NOT ("sentry_team"."org_role" IS
            NULL)"
      `);
    });
  });

  describe('SQLishFormatter.toSimpleMarkup()', () => {
    const formatter = new SQLishFormatter();
    const getMarkup = (markup: any): string => {
      const {container} = render(<Fragment>{markup}</Fragment>);

      return container.innerHTML;
    };

    beforeEach(() => {
      // The renderer throws an error because elements in the list do not have
      // a `"key"` prop, but that's intentional. The list elements are spans
      // with no semantic meaning, and their keys are not meaningful.
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
    });

    it('Capitalizes keywords', () => {
      expect(getMarkup(formatter.toSimpleMarkup('select hello'))).toMatchInlineSnapshot(
        `"<b>SELECT</b><span> </span><span>hello</span>"`
      );
    });

    it('Wraps every token in a `<span>` element', () => {
      expect(getMarkup(formatter.toSimpleMarkup('SELECT hello;'))).toMatchInlineSnapshot(
        `"<b>SELECT</b><span> </span><span>hello;</span>"`
      );
    });
  });
});
