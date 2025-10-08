import type {Sensitivity} from 'sentry/types/prevent';

import {PreventAIConfigFixture} from './prevent';

describe('PreventAIConfigFixture', () => {
  it('should return a valid PreventAIConfig object', () => {
    const fixture = PreventAIConfigFixture();
    
    expect(fixture).toHaveProperty('schema_version', 'v1');
    expect(fixture).toHaveProperty('github_organizations');
    expect(fixture).toHaveProperty('default_org_config');
    expect(fixture.default_org_config).toHaveProperty('org_defaults');
    expect(fixture.default_org_config).toHaveProperty('repo_overrides');
  });
  
  it('should have proper sensitivity types for all features', () => {
    const fixture = PreventAIConfigFixture();
    const orgDefaults = fixture.default_org_config.org_defaults;
    
    expect(orgDefaults.bug_prediction.sensitivity).toBe('medium');
    expect(orgDefaults.test_generation.sensitivity).toBe('medium');
    expect(orgDefaults.vanilla.sensitivity).toBe('medium');
    
    // Type check - should be of type Sensitivity
    const bugPredictionSensitivity: Sensitivity = orgDefaults.bug_prediction.sensitivity!;
    const testGenerationSensitivity: Sensitivity = orgDefaults.test_generation.sensitivity!;
    const vanillaSensitivity: Sensitivity = orgDefaults.vanilla.sensitivity!;
    
    expect(bugPredictionSensitivity).toBe('medium');
    expect(testGenerationSensitivity).toBe('medium');
    expect(vanillaSensitivity).toBe('medium');
  });
  
  it('should have all features disabled by default', () => {
    const fixture = PreventAIConfigFixture();
    const orgDefaults = fixture.default_org_config.org_defaults;
    
    expect(orgDefaults.bug_prediction.enabled).toBe(false);
    expect(orgDefaults.test_generation.enabled).toBe(false);
    expect(orgDefaults.vanilla.enabled).toBe(false);
  });
  
  it('should have all triggers disabled by default', () => {
    const fixture = PreventAIConfigFixture();
    const orgDefaults = fixture.default_org_config.org_defaults;
    
    Object.values(orgDefaults).forEach(feature => {
      expect(feature.triggers.on_command_phrase).toBe(false);
      expect(feature.triggers.on_ready_for_review).toBe(false);
    });
  });
  
  it('should have empty github_organizations and repo_overrides by default', () => {
    const fixture = PreventAIConfigFixture();
    
    expect(fixture.github_organizations).toEqual({});
    expect(fixture.default_org_config.repo_overrides).toEqual({});
  });
});