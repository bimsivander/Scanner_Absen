const API_URL =
  'https://script.google.com/macros/s/AKfycbw1410eA3xi4N3A_ZMALmesoJJRGSEEQ7L7pj20OQ-xvHi86w59CI4GkYcD2J-dP6LjMw/exec';


const params =
  new URLSearchParams(
    window.location.search
  );


const token =
  params.get('token') || '';


const sesiId =
  params.get('sesiId') || '';


const kelasId =
  params.get('kelasId') || '';


let scanner = null;

let scanning = false;


/* =====================================================
   INIT
===================================================== */

document.addEventListener(
  'DOMContentLoaded',
  function() {

    if (!token || !sesiId) {

      showResult(
        'Link scanner tidak lengkap.',
        'error'
      );

      return;
    }

    loadSession();

  }
);


/* =====================================================
   API JSONP
===================================================== */

function api(
  action,
  data
) {

  data =
    data || {};

  return new Promise(
    function(resolve,reject) {

      const callbackName =
        'callback_' +
        Date.now() +
        '_' +
        Math.random()
          .toString(36)
          .substring(2);

      const script =
        document.createElement(
          'script'
        );

      const query =
        new URLSearchParams();

      query.set(
        'action',
        action
      );

      query.set(
        'callback',
        callbackName
      );

      Object.keys(data)
        .forEach(function(key) {

          if (
            data[key] !==
            undefined &&
            data[key] !== null
          ) {
            query.set(
              key,
              data[key]
            );
          }

        });

      const cleanup =
        function() {

          delete window[
            callbackName
          ];

          if (
            script.parentNode
          ) {
            script.parentNode
              .removeChild(script);
          }
        };

      window[
        callbackName
      ] =
        function(response) {

          cleanup();

          if (
            !response ||
            response.success === false
          ) {
            reject(
              new Error(
                response &&
                response.message
                  ? response.message
                  : 'Request gagal.'
              )
            );

            return;
          }

          resolve(response);
        };

      script.onerror =
        function() {

          cleanup();

          reject(
            new Error(
              'Tidak dapat terhubung ke server.'
            )
          );
        };

      script.src =
        API_URL +
        '?' +
        query.toString();

      document.body.appendChild(
        script
      );

    }
  );
}


/* =====================================================
   SESSION
===================================================== */

function loadSession() {

  api(
    'getSessions',
    {
      token:
        token,

      kelasId:
        kelasId,

      sesiId:
        sesiId
    }
  )
  .then(function(response) {

    const sessions =
      response.data || [];

    const session =
      sessions.find(
        function(item) {
          return (
            item.SesiID ===
            sesiId
          );
        }
      );

    if (!session) {

      document.getElementById(
        'sessionInfo'
      ).textContent =
        'Sesi tidak ditemukan.';

      return;
    }

    document.getElementById(
      'sessionInfo'
    ).textContent =
      (
        session.NamaMapel ||
        session.MapelID
      ) +
      ' • ' +
      session.NamaKelas +
      ' • ' +
      session.JamMulai +
      '-' +
      session.JamSelesai;

  })
  .catch(function(error) {

    showResult(
      error.message,
      'error'
    );

  });
}


/* =====================================================
   CAMERA
===================================================== */

function startScanner() {

  if (scanning) {
    return;
  }

  scanner =
    new Html5Qrcode(
      'reader'
    );

  scanner
    .start(
      {
        facingMode:
          {
            exact:
              'environment'
          }
      },

      {
        fps:10,

        qrbox:{
          width:250,
          height:250
        }
      },

      onScanSuccess,

      function() {}
    )
    .then(function() {

      scanning = true;

      document.getElementById(
        'startButton'
      ).textContent =
        'Kamera Aktif';

    })
    .catch(function(error) {

      showResult(
        'Kamera tidak dapat digunakan: ' +
        error,
        'error'
      );

    });
}


function stopScanner() {

  if (
    !scanner ||
    !scanning
  ) {
    return;
  }

  scanner
    .stop()
    .then(function() {

      scanning = false;

    })
    .catch(function() {});

}


/* =====================================================
   QR RESULT
===================================================== */

let processing = false;


function onScanSuccess(
  decodedText
) {

  if (processing) {
    return;
  }

  processing = true;

  const siswaId =
    normalizeQR(
      decodedText
    );

  if (!siswaId) {

    showResult(
      'QR Code tidak valid.',
      'error'
    );

    processing = false;

    return;
  }

  stopScanner();

  showResult(
    'Memproses ' +
    siswaId +
    '...',
    'loading'
  );

  api(
    'scanQR',
    {
      token:
        token,

      siswaId:
        siswaId,

      sesiId:
        sesiId
    }
  )
  .then(function(response) {

    const data =
      response.data || {};

    showResult(
      '✓ ' +
      (
        data.NamaLengkap ||
        siswaId
      ) +
      ' berhasil hadir.',
      'success'
    );

    setTimeout(
      function() {

        processing = false;

        startScanner();

      },
      1500
    );

  })
  .catch(function(error) {

    showResult(
      error.message,
      'error'
    );

    setTimeout(
      function() {

        processing = false;

        startScanner();

      },
      1500
    );

  });
}


/* =====================================================
   QR NORMALIZER
===================================================== */

function normalizeQR(
  value
) {

  let text =
    String(
      value || ''
    ).trim();

  if (!text) {
    return '';
  }

  /*
   * QR langsung:
   * STD001
   */

  if (
    /^STD\d+$/i.test(text)
  ) {
    return text.toUpperCase();
  }


  /*
   * URL:
   * ?siswaId=STD001
   */

  try {

    const url =
      new URL(text);

    const siswaId =
      url.searchParams.get(
        'siswaId'
      );

    if (siswaId) {
      return siswaId
        .trim()
        .toUpperCase();
    }

  } catch(error) {}


  /*
   * Format lama:
   * HADIRR|STD001
   */

  if (
    text
      .toUpperCase()
      .startsWith(
        'HADIRR|'
      )
  ) {

    return text
      .split('|')[1]
      .trim()
      .toUpperCase();

  }

  return '';
}


/* =====================================================
   RESULT
===================================================== */

function showResult(
  message,
  type
) {

  const element =
    document.getElementById(
      'result'
    );

  element.className =
    'result ' +
    type;

  element.textContent =
    message;

  element.classList.remove(
    'hidden'
  );

}
