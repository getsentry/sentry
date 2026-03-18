import {fzf} from 'sentry/utils/search/fzf';

describe('fzf', () => {
  it('merges matched ranges', () => {
    expect(fzf('a_bc', 'abc', false).matches).toEqual([
      [0, 1],
      [2, 4],
    ]);
  });

  it('prioritizes exact matches over partial matches', () => {
    const pattern = 'path';
    const options = ['binary_path', 'code.file.path', 'path'];

    const [binaryPath, codeFilePath, exactPath] = options.map(option =>
      fzf(option, pattern, false)
    );

    // Verify all options matched
    expect(binaryPath!.end).not.toBe(-1);
    expect(codeFilePath!.end).not.toBe(-1);
    expect(exactPath!.end).not.toBe(-1);

    // Exact match should have a higher score than all partial matches
    expect(exactPath!.score).toBeGreaterThan(binaryPath!.score);
    expect(exactPath!.score).toBeGreaterThan(codeFilePath!.score);
  });

  // ─── Substring preference: short-pattern edge cases ─────────────────────────
  //
  // The fzf v1 algorithm rewards word-boundary hits with a +8 bonus per character.
  // This can cause a *scattered* match (where each character starts a separate word)
  // to outscore a *contiguous substring* match that starts mid-word.
  //
  // Concrete failure: pattern "sco" in
  //   "sentry.connect.ops@sentry.io"  → score 72  (s@boundary, c@boundary, o consecutive)
  //   "discovery.channel@sentry.io"   → score 56  ("sco" is a true substring in "discovery")
  //
  // The scattered match wins today even though the substring match is what the user
  // almost certainly wants. The tests below document this expected ordering so that
  // any fix can be validated.

  describe('prefers contiguous substring over scattered boundary matches', () => {
    // Dataset mirrors the screenshot: a Sentry org member search mixing labels,
    // emails where the pattern appears as a scattered subsequence, and emails that
    // genuinely contain the pattern as a contiguous substring.
    const members = [
      // Labels / short identifiers
      '#issue-detection',
      // Scattered: s, c, o appear in order but separated by multiple words/chars
      'christopher.klochek@sentry.io',
      'dominik.buszowiecki@sentry.io',
      'isaac.wang@sentry.io',
      // Problematic scattered: s starts the string (boundary +8×2), c comes after a
      // dot (boundary +8), o is consecutive with c — total score beats mid-word substrings
      'sentry.connect.ops@sentry.io',
      // True substrings: "sco" appears as contiguous characters, but mid-word (no
      // boundary bonus on the first matched character)
      'discovery.channel@sentry.io', // dis|sco|very  → "sco" at index 2
      'discovery.source@sentry.io', // dis|sco|very  → "sco" at index 2
      'francesco.novy@sentry.io', // frances|sco|  → "sco" at index 6
      // Prefix: "sco" is a contiguous substring AND starts at position 0 of the string
      'scott.morrison@sentry.io',
      // Boundary substring (not prefix): "sco" starts a word-component but not
      // the whole string — should rank below a true prefix match
      'aaron.scotton@sentry.io', // sidx=6, after "aaron."
      'thread.scope@sentry.io', // sidx=7, after "thread."
    ];

    function search(pattern: string) {
      return members
        .map(m => ({m, result: fzf(m, pattern, false)}))
        .filter(({result}) => result.end !== -1)
        .sort((a, b) => b.result.score - a.result.score);
    }

    // ↓ This currently FAILS: prefix and boundary-substring both score 80 (same
    //   boundary bonus, different sidx). A prefix bonus for sidx === 0 fixes it.
    it('ranks prefix match (sidx=0) above boundary-substring (sidx>0)', () => {
      const results = search('sco');
      const prefix = results.find(r => r.m === 'scott.morrison@sentry.io');
      const boundarySubstrings = [
        results.find(r => r.m === 'aaron.scotton@sentry.io'),
        results.find(r => r.m === 'thread.scope@sentry.io'),
      ];

      expect(prefix).toBeDefined();
      for (const sub of boundarySubstrings) {
        expect(sub).toBeDefined();
        expect(prefix!.result.score).toBeGreaterThan(sub!.result.score);
      }
    });

    it('ranks boundary-substring above mid-word substring', () => {
      const results = search('sco');
      const boundarySubstring = results.find(r => r.m === 'aaron.scotton@sentry.io');
      const midWordSubstring = results.find(r => r.m === 'discovery.channel@sentry.io');

      expect(boundarySubstring).toBeDefined();
      expect(midWordSubstring).toBeDefined();
      expect(boundarySubstring!.result.score).toBeGreaterThan(
        midWordSubstring!.result.score
      );
    });

    // ↓ This currently FAILS: scattered "sentry.connect.ops" scores 72, but the
    //   true substring matches ("discovery.*", "francesco.*") score only 56.
    it('ranks mid-word substring matches above scattered boundary matches', () => {
      const results = search('sco');
      const scattered = results.find(r => r.m === 'sentry.connect.ops@sentry.io');
      const substrings = [
        results.find(r => r.m === 'discovery.channel@sentry.io'),
        results.find(r => r.m === 'discovery.source@sentry.io'),
        results.find(r => r.m === 'francesco.novy@sentry.io'),
      ];

      expect(scattered).toBeDefined();
      for (const sub of substrings) {
        expect(sub).toBeDefined();
        expect(sub!.result.score).toBeGreaterThan(scattered!.result.score);
      }
    });

    it('produces the full expected ranking: prefix > boundary-sub > mid-word-sub > scattered', () => {
      const results = search('sco');

      const score = (m: string) => results.find(r => r.m === m)!.result.score;

      // Tier 1: prefix (sidx=0)
      const prefixScore = score('scott.morrison@sentry.io');
      // Tier 2: boundary substring (sidx>0, starts a word component)
      const boundarySubScore = Math.min(
        score('aaron.scotton@sentry.io'),
        score('thread.scope@sentry.io')
      );
      // Tier 3: mid-word substring (no boundary on first matched char)
      const midWordSubScore = Math.min(
        score('discovery.channel@sentry.io'),
        score('discovery.source@sentry.io'),
        score('francesco.novy@sentry.io')
      );
      // Tier 4: scattered
      const scatteredScore = score('sentry.connect.ops@sentry.io');

      expect(prefixScore).toBeGreaterThan(boundarySubScore);
      expect(boundarySubScore).toBeGreaterThan(midWordSubScore);
      expect(midWordSubScore).toBeGreaterThan(scatteredScore);
    });
  });

  // ─── Realistic OTel attribute key search ─────────────────────────────────────
  // A user typing "db.n" most likely wants
  // "db.name" rather than a scattered hit like "db_connection" where d, b, n happen
  // to appear in order across word boundaries.
  describe('otel attribute search', () => {
    // Realistic set of OTel semantic convention attribute keys
    const attributes = [
      'db.name',
      'db.type',
      'db.statement',
      'db.connection_string',
      'db.user',
      'http.method',
      'http.status_code',
      'http.url',
      'net.host.name',
      'net.peer.ip',
      'service.name',
      'service.version',
      'span.kind',
      'thread.id',
      'thread.name',
    ];

    function search(pattern: string) {
      return attributes
        .map(attr => ({attr, result: fzf(attr, pattern, false)}))
        .filter(({result}) => result.end !== -1)
        .sort((a, b) => b.result.score - a.result.score);
    }

    it('ranks db.name above db.connection_string when searching "db.n"', () => {
      const results = search('db.n');
      const dbName = results.find(r => r.attr === 'db.name');
      const dbConnString = results.find(r => r.attr === 'db.connection_string');

      expect(dbName).toBeDefined();
      expect(dbConnString).toBeDefined();
      expect(dbName!.result.score).toBeGreaterThan(dbConnString!.result.score);
    });

    it('ranks service.name first when searching "sn"', () => {
      const results = search('sn');
      // "service.name" contains "s" and "n" as a near-prefix substring
      // "span.kind" also starts with s and has n later but further apart
      const serviceName = results.find(r => r.attr === 'service.name');
      const spanKind = results.find(r => r.attr === 'span.kind');

      expect(serviceName).toBeDefined();
      expect(spanKind).toBeDefined();
      expect(serviceName!.result.score).toBeGreaterThan(spanKind!.result.score);
    });

    it('ranks net.host.name above scattered matches when searching "name"', () => {
      const results = search('name');
      // "db.name", "service.name", "thread.name", "net.host.name" all contain "name"
      // as a contiguous substring — they should all outrank any scattered match
      const topResults = results.slice(0, 4).map(r => r.attr);
      expect(topResults).toContain('db.name');
      expect(topResults).toContain('service.name');
      expect(topResults).toContain('thread.name');
      expect(topResults).toContain('net.host.name');
    });
  });

  // A user searching through a contact list by typing a first or last name should
  // see the full-name substring match before scattered hits that happen to share letters.
  describe('user full name search', () => {
    // Realistic mix of names including some that share letters with common queries
    const users = [
      'Alice Johnson',
      'Bob Martinez',
      'Carlos Rivera',
      'Diana Chen',
      'Eric Thompson',
      'Fiona Scott',
      'George Harris',
      'Hannah Lee',
      'Ivan Petrov',
      'Julia Roberts',
      'Kevin Anderson',
      'Laura Mitchell',
      'Michael Brown',
      'Natalie Davis',
      'Oscar Wilson',
    ];

    function search(pattern: string) {
      return users
        .map(name => ({name, result: fzf(name.toLowerCase(), pattern, false)}))
        .filter(({result}) => result.end !== -1)
        .sort((a, b) => b.result.score - a.result.score);
    }

    it('ranks "Michael Brown" above scattered matches when searching "mich"', () => {
      const results = search('mich');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.name).toBe('Michael Brown');
    });

    it('ranks "Hannah Lee" above others when searching "lee"', () => {
      const results = search('lee');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.name).toBe('Hannah Lee');
    });

    it('ranks "Carlos Rivera" above "Laura Mitchell" when searching "riv"', () => {
      const results = search('riv');
      const carlos = results.find(r => r.name === 'Carlos Rivera');
      const laura = results.find(r => r.name === 'Laura Mitchell');

      // "riv" is a substring of "Rivera"; Mitchell contains r, i, v scattered
      expect(carlos).toBeDefined();
      if (laura) {
        expect(carlos!.result.score).toBeGreaterThan(laura!.result.score);
      }
    });

    it('places the exact last-name match first when searching "davis"', () => {
      const results = search('davis');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.name).toBe('Natalie Davis');
    });
  });

  // Searching through a list of email addresses. Users often type a prefix of the
  // local part or domain; those prefix/substring matches should beat scattered hits.
  describe('email address search', () => {
    // Realistic set of work email addresses
    const emails = [
      'alice.johnson@acme.com',
      'bob.martinez@acme.com',
      'carlos.rivera@globex.io',
      'diana.chen@initech.co',
      'eric.thompson@acme.com',
      'fiona.scott@umbrella.org',
      'george.harris@globex.io',
      'hannah.lee@initech.co',
      'ivan.petrov@acme.com',
      'julia.roberts@umbrella.org',
      'support@acme.com',
      'noreply@globex.io',
      'admin@initech.co',
    ];

    function search(pattern: string) {
      return emails
        .map(email => ({email, result: fzf(email, pattern, false)}))
        .filter(({result}) => result.end !== -1)
        .sort((a, b) => b.result.score - a.result.score);
    }

    it('ranks "support@acme.com" first when searching "support"', () => {
      const results = search('support');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.email).toBe('support@acme.com');
    });

    it('ranks globex.io emails above others when searching "globex"', () => {
      const results = search('globex');
      const globexEmails = results.filter(r => r.email.includes('globex.io'));
      const nonGlobexEmails = results.filter(r => !r.email.includes('globex.io'));

      expect(globexEmails.length).toBeGreaterThan(0);
      // Every globex email should outscore every non-globex email
      for (const g of globexEmails) {
        for (const n of nonGlobexEmails) {
          expect(g.result.score).toBeGreaterThan(n.result.score);
        }
      }
    });

    it('ranks "diana.chen@initech.co" above scattered matches when searching "chen"', () => {
      const results = search('chen');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.email).toBe('diana.chen@initech.co');
    });

    it('ranks "alice.johnson@acme.com" above others when searching "alice"', () => {
      const results = search('alice');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.email).toBe('alice.johnson@acme.com');
    });
  });
});
