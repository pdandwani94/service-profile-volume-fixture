export class VolumeLimitExceeded extends Error {
  code = 'volume_limit_exceeded';
  status = 429;

  constructor() {
    super('volume_limit_exceeded');
  }
}
