// Shared helper functions used across all pages

function getLogoClass(type) {
  const map = {
    'IIT': 'logo-iit',
    'IIM': 'logo-iim',
    'NIT': 'logo-nit',
    'IIIT': 'logo-nit',
    'deemed': 'logo-bits',
    'private': 'logo-private',
    'abroad': 'logo-abroad',
    'state': 'logo-default'
  };
  return map[type] || 'logo-default';
}

function getAbbr(name, type) {
  if (type === 'IIT') return 'IIT';
  if (type === 'IIM') return 'IIM';
  if (type === 'NIT') return 'NIT';
  if (type === 'IIIT') return 'IIIT';
  if (type === 'abroad') return name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  return name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
}