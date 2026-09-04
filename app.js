// ============================================================
// DGSL SITE REGISTER
// Supabase Database + Storage + Live Updates
// Photos + Signatures + PDF + Backup
// ============================================================

const SUPABASE_URL =
  'https://mgxbsxqgjxpdvdjsixqi.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_XWLtSyttiEMQA86unKN37A_ZC9OY19j';

const PHOTO_BUCKET =
  'handover-photos-test';

const LOGO_FILE =
  'dgsl-logo.png';

let supabaseClient = null;
let records = [];
let editing = null;
let filter = 'All';

const $ = s => document.querySelector(s);

const rows = $('#rows');
const dlg = $('#formDialog');
const form = $('#handoverForm');

const today = () =>
  new Date().toISOString().slice(0, 10);


// ============================================================
// START SUPABASE
// ============================================================

async function loadSupabase() {

  if (!window.supabase) {

    await new Promise((resolve, reject) => {

      const script =
        document.createElement('script');

      script.src =
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

      script.onload = resolve;
      script.onerror = reject;

      document.head.appendChild(script);

    });

  }

  supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

}


// ============================================================
// ADD LOGO TO HANDOVER FORM
// ============================================================

function addLogoToForm() {

  const formHead =
    form.querySelector('.form-head');

  if (!formHead) {
    return;
  }

  if (
    form.querySelector(
      '#handoverFormLogo'
    )
  ) {
    return;
  }

  const logo =
    document.createElement('img');

  logo.id =
    'handoverFormLogo';

  logo.src =
    LOGO_FILE;

  logo.alt =
    'DGSL Logo';

  logo.style.display =
    'block';

  logo.style.width =
    '220px';

  logo.style.maxWidth =
    '70%';

  logo.style.height =
    'auto';

  logo.style.objectFit =
    'contain';

  logo.style.margin =
    '0 auto 15px auto';

  formHead.parentNode.insertBefore(
    logo,
    formHead
  );

}


// ============================================================
// DATABASE → WEBSITE
// ============================================================

function fromDatabase(x) {

  let photos = [];

  try {

    photos =
      x.photos
        ? JSON.parse(x.photos)
        : [];

  } catch {

    photos = [];

  }


  let takeBackChecklist = {};

  try {

    takeBackChecklist =
      x.take_back_checklist
        ? JSON.parse(
            x.take_back_checklist
          )
        : {};

  } catch {

    takeBackChecklist = {};

  }


  return {

    id:
      x.id,

    zone:
      x.zone || '',

    level:
      x.level || '',

    drawing:
      x.drawing || '',

    trade:
      x.trade || '',

    contractor:
      x.contractor || '',

    foreman:
      x.foreman || '',

    description:
      x.description || '',

    status:
      x.status || '',

    handover:
      x.handover || '',

    handoverDate:
      x.handover_date || '',

    takeBackDate:
      x.take_back_date || '',
    
    closedDate:
      x.closed_date || '',

    notes:
      x.notes || '',

    contractorSigner:
      x.contractor_signer || '',

    dgslSigner:
      x.dgsl_signer || '',

    contractorSignature:
      x.contractor_signature || '',

    dgslSignature:
      x.dgsl_signature || '',

    photos:
      photos,

    healthSafetyScaffolding:
      x.health_safety_scaffolding || '',

    takeBackCompleteDrawings:
      x.take_back_complete_drawings || '',

    takeBackHousekeeping:
      x.take_back_housekeeping || '',

    takeBackSnagCompleted:
      x.take_back_snag_completed || '',

    takeBackChecklist:
      takeBackChecklist

  };

}


// ============================================================
// WEBSITE → DATABASE
// ============================================================

function toDatabase(x) {

  return {

    id:
      x.id,

    zone:
      x.zone || null,

    level:
      x.level || null,

    drawing:
      x.drawing || null,

    trade:
      x.trade || null,

    contractor:
      x.contractor || null,

    foreman:
      x.foreman || null,

    description:
      x.description || null,

    status:
      x.status || null,

    handover:
      null,

    handover_date:
      x.handoverDate || null,

    take_back_date:
      x.takeBackDate || null,

    closed_date:
      null,

    notes:
      x.notes || null,

    contractor_signer:
      x.contractorSigner || null,

    dgsl_signer:
      x.dgslSigner || null,

    contractor_signature:
      x.contractorSignature || null,

    dgsl_signature:
      x.dgslSignature || null,

    photos:
      JSON.stringify(
        x.photos || []
      ),

    health_safety_scaffolding:
      x.healthSafetyScaffolding || null,

    take_back_complete_drawings:
      x.takeBackCompleteDrawings || null,

    take_back_housekeeping:
      x.takeBackHousekeeping || null,

    take_back_snag_completed:
      x.takeBackSnagCompleted || null,

    take_back_checklist:
      JSON.stringify(
        x.takeBackChecklist || {}
      )

  };

}


// ============================================================
// LOAD RECORDS
// ============================================================

async function loadRecords() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from('handovers_test')
        .select('*');

    if (error) {
      throw error;
    }

    records =
      (data || [])
        .map(fromDatabase);

    render();

  } catch (error) {

    console.error(
      'Load error:',
      error
    );

    alert(
      'Could not load the handover register.'
    );

  }

}


// ============================================================
// REAL-TIME UPDATES
// ============================================================

function setupRealtime() {

  supabaseClient
    .channel('handovers-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'handovers'
      },
      async () => {

        await loadRecords();

      }
    )
    .subscribe();

}


// ============================================================
// HTML ESCAPE
// ============================================================

function formatDate(value) {
  if (!value) return '';

  const text = String(value).slice(0, 10);

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return String(value);

  return `${match[3]}-${match[2]}-${match[1]}`;
}


function esc(x = '') {

  return String(x)
    .replace(
      /[&<>"']/g,
      c => ({

        '&':
          '&amp;',

        '<':
          '&lt;',

        '>':
          '&gt;',

        '"':
          '&quot;',

        "'":
          '&#39;'

      }[c])
    );

}


// ============================================================
// RENDER
// ============================================================

function render() {

  const q =
    $('#search')
      ? $('#search')
          .value
          .toLowerCase()
      : '';

  const filtered =
    records.filter(x =>

      (
        filter === 'All' ||
        x.status === filter
      )

      &&

      Object.values(x)
        .join(' ')
        .toLowerCase()
        .includes(q)

    );


  $('#total').textContent =
    records.length;


  $('#progress').textContent =
    records.filter(
      x =>
        x.status ===
        'Work Permit Open'
    ).length;


  $('#closed').textContent =
    records.filter(
      x =>
        x.status ===
        'Work Permit Closed'
    ).length;


  $('#hold').textContent =
    records.filter(
      x =>
        x.status ===
        'Work Permit on Hold'
    ).length;


  rows.innerHTML =
    filtered
      .map(
        x => `

        <tr>

          <td>
            <b>
              ${esc(x.zone)}
            </b>
          </td>

          <td>
            ${esc(x.contractor)}
          </td>

          <td>
            ${esc(x.description)}
          </td>

          <td>

  <span
    class="status ${
      x.status === 'Work Permit Open'
        ? 'status-open'
        : x.status === 'Work Permit Closed'
          ? 'status-closed'
          : x.status === 'Work Permit on Hold'
            ? 'status-hold'
            : ''
    }"
  >
    ${esc(x.status)}
  </span>

</td>

          <td>
  ${esc(formatDate(x.handoverDate))}
</td>


<td>
  <button
              type="button"
              data-view="${esc(x.id)}"
            >
              View
            </button>

          </td>

          <td>
  <button
              type="button"
              data-edit="${esc(x.id)}"
            >
              Edit
            </button>

          </td>

        </tr>

        `
      )
      .join('');


  $('#empty')
    .classList
    .toggle(
      'hidden',
      filtered.length > 0
    );


  document
    .querySelectorAll(
      '[data-view]'
    )
    .forEach(
      button => {

        button.onclick =
          async function () {

            const id =
              this.getAttribute(
                'data-view'
              );

            const record =
              records.find(
                x => String(x.id) === String(id)
              );

            if (!record) return;

            try {

              open(record, false);

              const blob =
                await generatePdf(true);

              const reader =
                new FileReader();

              reader.onload =
                function () {

                  $('#pdfFrame').src =
                    reader.result;

                  $('#pdfDialog').showModal();

                };

              reader.onerror =
                function () {

                  alert(
                    'Unable to display the PDF.'
                  );

                };

              reader.readAsDataURL(blob);

            } catch (error) {

              console.error(error);

              alert(
                'Unable to generate the PDF.'
              );

            }

          };

      }
    );

  document
    .querySelectorAll(
      '[data-edit]'
    )
    .forEach(
      button => {

        button.onclick =
          function () {

            const id =
              this.getAttribute(
                'data-edit'
              );

            const record =
              records.find(
                x =>
                  String(x.id) ===
                  String(id)
              );

            if (record) {
              open(record);
            }

          };

      }
    );

}


// ============================================================
// CHECKLIST
// ============================================================

function getTakeBackChecklist() {

  const result = {};

  document
    .querySelectorAll(
      '.takeback-check'
    )
    .forEach(
      checkbox => {

        const item =
          checkbox.dataset.item;

        const answer =
          checkbox.dataset.answer;

        if (!result[item]) {
          result[item] = '';
        }

        if (checkbox.checked) {
          result[item] = answer;
        }

      }
    );

  return result;

}


// ============================================================
// RESTORE CHECKLIST
// ============================================================

function restoreTakeBackChecklist(
  checklist
) {

  document
    .querySelectorAll(
      '.takeback-check'
    )
    .forEach(
      checkbox => {

        const item =
          checkbox.dataset.item;

        const answer =
          checkbox.dataset.answer;


        if (
          checklist &&
          checklist[item]
        ) {

          checkbox.checked =
            checklist[item] === answer;

        } else {

          checkbox.checked =
            answer === 'yes';

        }

      }
    );

}


// ============================================================
// CHECKLIST YES / NO BEHAVIOUR
// ============================================================

document
  .querySelectorAll(
    '.takeback-check'
  )
  .forEach(
    checkbox => {

      checkbox.addEventListener(
        'change',
        function () {

          const item =
            this.dataset.item;

          const answer =
            this.dataset.answer;


          if (
            this.checked &&
            answer === 'no'
          ) {

            document
              .querySelectorAll(
                `.takeback-check[data-item="${item}"]`
              )
              .forEach(
                other => {

                  if (
                    other.dataset.answer ===
                    'yes'
                  ) {

                    other.checked =
                      false;

                  }

                }
              );

          }


          if (
            this.checked &&
            answer === 'yes'
          ) {

            document
              .querySelectorAll(
                `.takeback-check[data-item="${item}"]`
              )
              .forEach(
                other => {

                  if (
                    other.dataset.answer ===
                    'no'
                  ) {

                    other.checked =
                      false;

                  }

                }
              );

          }

        }
      );

    }
  );

// ============================================================
// OTHER DROPDOWN BEHAVIOUR
// ============================================================

function setupOtherDropdown(
  selectName,
  otherId
) {

  const select =
    form.elements[selectName];

  const other =
    document.getElementById(otherId);

  if (!select || !other) {
    return;
  }

  // Create a container around the dropdown and Other box
  const wrapper =
    document.createElement('div');

  wrapper.style.position =
    'relative';

  wrapper.style.width =
    '100%';

  // Put both controls inside the wrapper
  select.parentNode.insertBefore(
    wrapper,
    select
  );

  wrapper.appendChild(select);
  wrapper.appendChild(other);

  // Normal dropdown fills the whole field
  select.style.width =
    '100%';

  select.style.boxSizing =
    'border-box';

  // Other box starts hidden
  other.style.display =
    'none';

  other.disabled =
    true;

  select.addEventListener(
    'change',
    function () {

      if (this.value === 'Other') {

        // Keep the original dropdown visible,
        // including its original arrow.

        other.style.display =
          '';

        other.disabled =
          false;

        // Put the text box over the dropdown,
        // leaving the arrow area visible.
        other.style.position =
          'absolute';

        other.style.left =
          '0';

        other.style.top =
          '6px';

        other.style.width =
          'calc(100% - 45px)';

        other.style.height =
          'calc(100% - 6px)';

        other.style.boxSizing =
          'border-box';

        other.style.margin =
          '0';

        other.style.zIndex =
          '2';

        other.focus();

      } else {

        // A normal option was selected.
        other.style.display =
          'none';

        other.disabled =
          true;

        other.value =
          '';

        other.style.position =
          '';

        other.style.width =
          '';

        other.style.height =
          '';

        other.style.zIndex =
          '';
      }

    }
  );

}


setupOtherDropdown(
  'level',
  'levelOther'
);

setupOtherDropdown(
  'trade',
  'tradeOther'
);

setupOtherDropdown(
  'foreman',
  'foremanOther'
);

setupOtherDropdown(
  'healthSafetyScaffolding',
  'healthSafetyScaffoldingOther'
);

setupOtherDropdown(
  'status',
  'statusOther'
);

setupOtherDropdown(
  'takeBackCompleteDrawings',
  'takeBackCompleteDrawingsOther'
);

setupOtherDropdown(
  'takeBackHousekeeping',
  'takeBackHousekeepingOther'
);

setupOtherDropdown(
  'takeBackSnagCompleted',
  'takeBackSnagCompletedOther'
);
// ============================================================
// OPEN FORM
// ============================================================

function open(x, showDialog = true) {

  editing =
    x || null;


  $('#formTitle')
    .textContent =
      x
        ? 'Edit handover'
        : 'New handover';


  $('#delete')
    .classList
    .toggle(
      'hidden',
      !x
    );


  form.reset();

// Reset all dropdowns to their normal state
document.querySelectorAll('select').forEach(
  select => {
    select.style.display = '';
  }
);

// Hide all Other text boxes
document.querySelectorAll(
  'input[id$="Other"]'
).forEach(
  input => {
    input.style.display = 'none';
    input.disabled = true;
    input.value = '';
  }
);

// Hide all Change buttons
document.querySelectorAll(
  'button[id$="OtherChange"]'
).forEach(
  button => {
    button.style.display = 'none';
  }
);

clearSignature(
  $('#contractorSignature')
);


  clearSignature(
    $('#dgslSignature')
  );


  $('#photoPreview')
    .innerHTML =
      '';


  restoreTakeBackChecklist(
    {}
  );


  const values =
    x || {

      handoverDate:
        today(),

      status:
        'Work Permit Open'

    };


  for (
    const [key, value]
    of Object.entries(values)
  ) {

    const element =
      form.elements[key];


    if (!element) {
      continue;
    }


    if (
      element.type ===
      'file'
    ) {

      continue;

    }


    if (
      key === 'photos'
    ) {

      continue;

    }


    if (
      key ===
      'takeBackChecklist'
    ) {

      continue;

    }


    if (
  element.tagName === 'SELECT' &&
  element.value !== value
) {

  const otherField =
    document.getElementById(
      element.name + 'Other'
    );

  const optionExists =
    Array.from(element.options)
      .some(
        option =>
          option.value === value
      );

  if (optionExists) {

    element.value =
      value || '';

    if (otherField) {

      otherField.style.display =
        'none';

      otherField.disabled =
        true;

      otherField.value =
        '';
    }

  } else {

    element.value =
      'Other';

    if (otherField) {

// Keep the original dropdown visible
// so its arrow remains available.
element.style.display =
  '';

otherField.style.display =
  '';

      otherField.disabled =
        false;

      otherField.value =
        value || '';

    }

  }

} else {

  element.value =
    value || '';

}

  }


  if (x) {

    drawSavedSignature(
      $('#contractorSignature'),
      x.contractorSignature
    );


    drawSavedSignature(
      $('#dgslSignature'),
      x.dgslSignature
    );


    showSavedPhotos(
      x.photos
    );


    restoreTakeBackChecklist(
      x.takeBackChecklist
    );

  }


  if (showDialog) dlg.showModal();

}


// ============================================================
// NEW HANDOVER
// ============================================================

$('#newZone').onclick =
  () => open();


// ============================================================
// CANCEL
// ============================================================

$('#cancel').onclick =
$('#cancel2').onclick =
  () => dlg.close();


// ============================================================
// SAVE HANDOVER
// ============================================================

form.onsubmit =
  async e => {

    e.preventDefault();


    const saveButton =
      form.querySelector(
        'button[value="default"]'
      );


    try {

      if (saveButton) {

        saveButton.disabled =
          true;

        saveButton.textContent =
          'Saving...';

      }


      const x =
        Object.fromEntries(
          new FormData(form)
        );
      if (
  form.elements.level?.value === 'Other'
) {
  x.level =
    document.getElementById(
      'levelOther'
    ).value || 'Other';
}

if (
  form.elements.trade?.value === 'Other'
) {
  x.trade =
    document.getElementById(
      'tradeOther'
    ).value || 'Other';
}

if (
  form.elements.foreman?.value === 'Other'
) {
  x.foreman =
    document.getElementById(
      'foremanOther'
    ).value || 'Other';
}

if (
  form.elements.healthSafetyScaffolding?.value === 'Other'
) {
  x.healthSafetyScaffolding =
    document.getElementById(
      'healthSafetyScaffoldingOther'
    ).value || 'Other';
}

if (
  form.elements.status?.value === 'Other'
) {
  x.status =
    document.getElementById(
      'statusOther'
    ).value || 'Other';
}

if (
  form.elements.takeBackCompleteDrawings?.value === 'Other'
) {
  x.takeBackCompleteDrawings =
    document.getElementById(
      'takeBackCompleteDrawingsOther'
    ).value || 'Other';
}

if (
  form.elements.takeBackHousekeeping?.value === 'Other'
) {
  x.takeBackHousekeeping =
    document.getElementById(
      'takeBackHousekeepingOther'
    ).value || 'Other';
}

if (
  form.elements.takeBackSnagCompleted?.value === 'Other'
) {
  x.takeBackSnagCompleted =
    document.getElementById(
      'takeBackSnagCompletedOther'
    ).value || 'Other';
}
      


      x.id =
        editing?.id ||
        crypto.randomUUID();


      // ------------------------------------------------------
      // TAKE BACK CHECKLIST
      // ------------------------------------------------------

      x.takeBackChecklist =
        getTakeBackChecklist();


      // ------------------------------------------------------
      // SIGNATURES
      // ------------------------------------------------------

      x.contractorSignature =
        $('#contractorSignature')
          .toDataURL(
            'image/png'
          );


      x.dgslSignature =
        $('#dgslSignature')
          .toDataURL(
            'image/png'
          );


      // ------------------------------------------------------
      // EXISTING PHOTOS
      // ------------------------------------------------------

      x.photos =
        editing?.photos
          ? [...editing.photos]
          : [];


      // ------------------------------------------------------
// NEW PHOTOS
// ------------------------------------------------------

const files =
  Array.from(
    form.elements.photos?.files || []
  );

for (
  const file
  of files
) {

  if (
    !file.type.startsWith(
      'image/'
    )
  ) {

    continue;

  }

  const photoUrl =
    await uploadPhoto(
      file,
      x.id
    );

  if (photoUrl) {

    x.photos.push(
      photoUrl
    );

  }

}


      // ------------------------------------------------------
      // DATABASE RECORD
      // ------------------------------------------------------

      const databaseRecord =
        toDatabase(x);


      if (editing) {

        const {
          error
        } =
          await supabaseClient
            .from('handovers_test')
            .update(
              databaseRecord
            )
            .eq(
              'id',
              x.id
            );


        if (error) {
          throw error;
        }

      } else {

        const {
          error
        } =
          await supabaseClient
            .from('handovers_test')
            .insert(
              databaseRecord
            );


        if (error) {
          throw error;
        }

      }


      dlg.close();


      await loadRecords();


    } catch (error) {

      console.error(
        'Save error:',
        error
      );


      alert(
        'There was a problem saving the handover.\n\n' +
        error.message
      );


    } finally {

      if (saveButton) {

        saveButton.disabled =
          false;

        saveButton.textContent =
          'Save handover';

      }

    }

  };


// ============================================================
// UPLOAD PHOTO
// ============================================================

async function uploadPhoto(
  file,
  handoverId
) {

  const extension =
    (
      file.name
        .split('.')
        .pop() ||
      'jpg'
    )
      .toLowerCase();


  const filename =
    `${handoverId}/${crypto.randomUUID()}.${extension}`;


  const {
    error
  } =
    await supabaseClient
      .storage
      .from(
        PHOTO_BUCKET
      )
      .upload(
        filename,
        file,
        {
          cacheControl:
            '3600',

          upsert:
            false
        }
      );


  if (error) {
    throw error;
  }


  const {
    data
  } =
    supabaseClient
      .storage
      .from(
        PHOTO_BUCKET
      )
      .getPublicUrl(
        filename
      );


  return data.publicUrl;

}


// ============================================================
// SHOW SAVED PHOTOS
// ============================================================

function showSavedPhotos(
  photos
) {

  const preview =
    $('#photoPreview');


  if (!preview) {
    return;
  }


  preview.innerHTML =
    '';


  if (
    !Array.isArray(
      photos
    )
  ) {

    return;

  }


  photos.forEach(
    url => {

      const img =
        document.createElement(
          'img'
        );


      img.src =
        url;


      img.style.width =
        '110px';


      img.style.height =
        '80px';


      img.style.objectFit =
        'cover';


      img.style.borderRadius =
        '6px';


      img.style.border =
        '1px solid #ccc';


      img.style.marginRight =
        '6px';


      img.style.marginBottom =
        '6px';


      preview.appendChild(
        img
      );

    }
  );

}


// ============================================================
// DELETE HANDOVER
// ============================================================

$('#delete').onclick =
  async () => {

    if (!editing) {
      return;
    }


    if (
      !confirm(
        'Delete this handover record?'
      )
    ) {

      return;

    }


    try {

      if (
        Array.isArray(
          editing.photos
        )
      ) {

        for (
          const url
          of editing.photos
        ) {

          await deletePhoto(
            url
          );

        }

      }


      const {
        error
      } =
        await supabaseClient
          .from('handovers_test')
          .delete()
          .eq(
            'id',
            editing.id
          );


      if (error) {
        throw error;
      }


      dlg.close();


      await loadRecords();


    } catch (error) {

      console.error(
        'Delete error:',
        error
      );


      alert(
        'There was a problem deleting the handover.'
      );

    }

  };


// ============================================================
// DELETE PHOTO
// ============================================================

async function deletePhoto(
  url
) {

  try {

    const marker =
      `/object/public/${PHOTO_BUCKET}/`;


    const index =
      url.indexOf(
        marker
      );


    if (
      index === -1
    ) {

      return;

    }


    const path =
      decodeURIComponent(
        url.substring(
          index +
          marker.length
        )
      );


    await supabaseClient
      .storage
      .from(
        PHOTO_BUCKET
      )
      .remove(
        [path]
      );


  } catch (error) {

    console.error(
      'Photo delete error:',
      error
    );

  }

}


// ============================================================
// FILTERS
// ============================================================

document
  .querySelectorAll(
    '[data-filter]'
  )
  .forEach(
    button => {

      button.onclick =
        () => {

          filter =
            button.dataset.filter;


          document
            .querySelectorAll(
              '[data-filter]'
            )
            .forEach(
              x => {

                x.classList.toggle(
                  'active',
                  x === button
                );

              }
            );


          render();

        };

    }
  );


// ============================================================
// SEARCH
// ============================================================

$('#search').oninput =
  render;


// ============================================================
// SIGNATURE PAD
// ============================================================

function setupSignature(
  canvas
) {

  if (!canvas) {
    return;
  }


  const ctx =
    canvas.getContext(
      '2d'
    );


  ctx.lineWidth =
    2;


  ctx.lineCap =
    'round';


  ctx.lineJoin =
    'round';


  let drawing =
    false;


  function position(e) {

    const rect =
      canvas.getBoundingClientRect();


    const source =
      e.touches
        ? e.touches[0]
        : e;


    return {

      x:
        (
          source.clientX -
          rect.left
        ) *
        (
          canvas.width /
          rect.width
        ),


      y:
        (
          source.clientY -
          rect.top
        ) *
        (
          canvas.height /
          rect.height
        )

    };

  }


  function start(e) {

    e.preventDefault();


    drawing =
      true;


    const p =
      position(e);


    ctx.beginPath();


    ctx.moveTo(
      p.x,
      p.y
    );

  }


  function move(e) {

    if (!drawing) {
      return;
    }


    e.preventDefault();


    const p =
      position(e);


    ctx.lineTo(
      p.x,
      p.y
    );


    ctx.stroke();

  }


  function stop(e) {

    if (!drawing) {
      return;
    }


    e.preventDefault();


    drawing =
      false;


    ctx.closePath();

  }


  canvas.addEventListener(
    'mousedown',
    start
  );


  canvas.addEventListener(
    'mousemove',
    move
  );


  canvas.addEventListener(
    'mouseup',
    stop
  );


  canvas.addEventListener(
    'mouseleave',
    stop
  );


  canvas.addEventListener(
    'touchstart',
    start,
    {
      passive:
        false
    }
  );


  canvas.addEventListener(
    'touchmove',
    move,
    {
      passive:
        false
    }
  );


  canvas.addEventListener(
    'touchend',
    stop,
    {
      passive:
        false
    }
  );

}


// ============================================================
// CLEAR SIGNATURE
// ============================================================

function clearSignature(
  canvas
) {

  if (!canvas) {
    return;
  }


  const ctx =
    canvas.getContext(
      '2d'
    );


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

}


// ============================================================
// RESTORE SIGNATURE
// ============================================================

function drawSavedSignature(
  canvas,
  dataUrl
) {

  if (
    !canvas ||
    !dataUrl
  ) {

    return;

  }


  const ctx =
    canvas.getContext(
      '2d'
    );


  const img =
    new Image();


  img.onload =
    () => {

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );


      ctx.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
      );

    };


  img.src =
    dataUrl;

}


// ============================================================
// INITIALISE SIGNATURES
// ============================================================

setupSignature(
  $('#contractorSignature')
);


setupSignature(
  $('#dgslSignature')
);


// ============================================================
// CLEAR SIGNATURE BUTTONS
// ============================================================

$('#clearContractorSignature')
  .onclick =
    () =>
      clearSignature(
        $('#contractorSignature')
      );


$('#clearDgslSignature')
  .onclick =
    () =>
      clearSignature(
        $('#dgslSignature')
      );


// ============================================================
// EXPORT BACKUP
// ============================================================

$('#export').onclick =
  () => {

    const link =
      document.createElement(
        'a'
      );


    link.href =
      URL.createObjectURL(

        new Blob(

          [
            JSON.stringify(
              records,
              null,
              2
            )
          ],

          {
            type:
              'application/json'
          }

        )

      );


    link.download =
      `DGSL-site-register-${today()}` +
      `.json`;


    link.click();


    URL.revokeObjectURL(
      link.href
    );

  };


// ============================================================
// IMPORT BACKUP
// ============================================================

$('#import').onchange =
  async e => {

    const file =
      e.target.files[0];


    if (!file) {
      return;
    }


    const reader =
      new FileReader();


    reader.onload =
      async () => {

        try {

          const imported =
            JSON.parse(
              reader.result
            );


          if (
            !Array.isArray(
              imported
            )
          ) {

            throw new Error(
              'Invalid backup'
            );

          }


          for (
            const record
            of imported
          ) {

            const databaseRecord =
              toDatabase(
                record
              );


            const {
              error
            } =
              await supabaseClient
                .from('handovers_test')
                .upsert(
                  databaseRecord
                );


            if (error) {
              throw error;
            }

          }


          await loadRecords();


          alert(
            'Backup imported.'
          );


        } catch (error) {

          console.error(
            error
          );


          alert(
            'That file is not a valid DGSL backup.'
          );

        }

      };


    reader.readAsText(
      file
    );

  };


// ============================================================
// GENERATE PDF
// ============================================================

$('#generatePdf').onclick =
  async () => {

    await generatePdf();

  };


async function generatePdf(viewOnly = false) {

  try {

    const {
      jsPDF
    } =
      window.jspdf;


    const pdf =
      new jsPDF({

        orientation:
          'portrait',

        unit:
          'mm',

        format:
          'a4'

      });


    const margin =
      15;


    const pageWidth =
      210;


    let y =
      20;


    const logoData =
      await loadLogoForPdf();


    // --------------------------------------------------------
    // TITLE
    // --------------------------------------------------------

    pdf.setFontSize(
      20
    );


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.text(
      'DGSL SITE HANDOVER',
      margin,
      y
    );


    // Correct logo proportions
    if (logoData) {

      pdf.addImage(
        logoData,
        'PNG',
        140,
        10,
        55,
        11.1
      );

    }


    y += 8;


    pdf.setFontSize(
      14
    );


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.text(
      'Knocksedan, PH3',
      margin,
      y
    );


    y += 10;


    pdf.line(
      margin,
      y,
      pageWidth - margin,
      y
    );


    y += 8;


    const data = {
  zone: form.elements.zone?.value || '',
  contractor: form.elements.contractor?.value || '',
  drawing: form.elements.drawing?.value || '',
  level:
  form.elements.level?.value === 'Other'
    ? document.getElementById('levelOther').value || 'Other'
    : form.elements.level?.value || '',

trade:
  form.elements.trade?.value === 'Other'
    ? document.getElementById('tradeOther').value || 'Other'
    : form.elements.trade?.value || '',

foreman:
  form.elements.foreman?.value === 'Other'
    ? document.getElementById('foremanOther').value || 'Other'
    : form.elements.foreman?.value || '',

healthSafetyScaffolding:
  form.elements.healthSafetyScaffolding?.value === 'Other'
    ? document.getElementById('healthSafetyScaffoldingOther').value || 'Other'
    : form.elements.healthSafetyScaffolding?.value || '',
  description: form.elements.description?.value || '',
  status:
  form.elements.status?.value === 'Other'
    ? document.getElementById('statusOther').value || 'Other'
    : form.elements.status?.value || '',
  handoverDate: form.elements.handoverDate?.value || '',
  takeBackDate: form.elements.takeBackDate?.value || '',
  takeBackCompleteDrawings:
  form.elements.takeBackCompleteDrawings?.value === 'Other'
    ? document.getElementById('takeBackCompleteDrawingsOther').value || 'Other'
    : form.elements.takeBackCompleteDrawings?.value || '',
  takeBackHousekeeping:
  form.elements.takeBackHousekeeping?.value === 'Other'
    ? document.getElementById('takeBackHousekeepingOther').value || 'Other'
    : form.elements.takeBackHousekeeping?.value || '',
  takeBackSnagCompleted:
  form.elements.takeBackSnagCompleted?.value === 'Other'
    ? document.getElementById('takeBackSnagCompletedOther').value || 'Other'
    : form.elements.takeBackSnagCompleted?.value || '',
  notes: form.elements.notes?.value || '',
  contractorSigner:
    form.elements.contractorSigner?.value || '',
  dgslSigner:
    form.elements.dgslSigner?.value || ''
};


    // --------------------------------------------------------
    // PDF FIELD
    // Fixed label/value columns so text cannot overlap.
    // --------------------------------------------------------

    function addField(
      label,
      value
    ) {

      pdf.setFontSize(
        10
      );


      // Dedicated space for the label.
      const labelWidth =
        55;


      // Value starts after the label area.
      const valueX =
        margin + 60;


      // Remaining page width for the value.
      const valueWidth =
        pageWidth -
        margin -
        valueX;


      // Wrap long labels.
      const labelLines =
        pdf.splitTextToSize(
          `${label}:`,
          labelWidth
        );


      // Wrap long values.
      const valueLines =
        pdf.splitTextToSize(
          value || '',
          valueWidth
        );


      // Label
      pdf.setFont(
        undefined,
        'bold'
      );


      pdf.text(
        labelLines,
        margin,
        y
      );


      // Value
      pdf.setFont(
        undefined,
        'normal'
      );


      pdf.text(
        valueLines,
        valueX,
        y
      );


      // Move down far enough for whichever side
      // contains the most lines.
      const lineCount =
        Math.max(
          labelLines.length,
          valueLines.length
        );


      y +=
        Math.max(
          7,
          lineCount * 5
        );

    }


    // --------------------------------------------------------
    // HANDOVER DETAILS
    // --------------------------------------------------------

    addField(
      'Zone / Area',
      data.zone
    );


    addField(
      'Sub Contractor / Company Name',
      data.contractor
    );


    addField(
      'Drawing / Reference',
      data.drawing
    );


    addField(
      'Safety Documents',
      data.level
    );


    addField(
      'Housekeeping at time of Take Over',
      data.trade
    );


    addField(
      'Materials Checks',
      data.foreman
    );


    addField(
      'Health & Safety - Scaffolding / Handrails',
      data.healthSafetyScaffolding
    );


    addField(
      'Work Description',
      data.description
    );


    addField(
      'Status',
      data.status
    );


    addField(
      'Handover Date',
      formatDate(data.handoverDate)
    );


    // --------------------------------------------------------
    // CHECKLIST
    // --------------------------------------------------------

    y += 5;


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.setFontSize(
      12
    );


    pdf.text(
      'Checklist',
      margin,
      y
    );


    y += 7;


    pdf.setFontSize(
      10
    );


    pdf.setFont(
      undefined,
      'normal'
    );


    const checklistItems = [

      'Current approved drawings, specification, RFI responses, setting-out data and revisions available at workface.',

      'Task-specific RAMS briefed; workers inducted; Safe Pass / CSCS / trade competence checked as applicable.',

      'Work area, access, lighting, scaffold / edge protection, temporary works, previous trade and substrate accepted',

      'Materials / products approved and traceable; plant, tools and test equipment inspected / certified / calibrated.',

      'Interfaces with adjacent trades, services, deliveries, exclusion zones and shared access agreed.',

      'Protection of completed work plus weather, water, dust, noise and environmental controls agreed.',

      'Hold / Witness Points, first-off, photos, tests and QA records identified; emergency, waste, housekeeping and security controls agreed.'

    ];


    const checklist =
      getTakeBackChecklist();


    checklistItems.forEach(
      (item, index) => {

        if (
          y > 265
        ) {

          pdf.addPage();

          y =
            20;


          if (logoData) {

            pdf.addImage(
              logoData,
              'PNG',
              140,
              10,
              55,
              11.1
            );

          }

        }


        const itemNumber =
          index + 1;


        const answer =
          checklist[itemNumber] ||
          'yes';


        const lines =
          pdf.splitTextToSize(
            `${itemNumber}. ${item}`,
            145
          );


        pdf.text(
          lines,
          margin,
          y
        );


        pdf.setFont(
          undefined,
          'bold'
        );


        pdf.text(
          'Yes',
          165,
          y
        );


        pdf.text(
          'No',
          185,
          y
        );


        pdf.setFont(
          undefined,
          'normal'
        );


        const boxY =
          y - 3;


        pdf.rect(
          160,
          boxY,
          4,
          4
        );


        pdf.rect(
          180,
          boxY,
          4,
          4
        );


        if (
          answer === 'yes'
        ) {

          pdf.setFont(
            undefined,
            'bold'
          );


          pdf.text(
            'X',
            161,
            y
          );


          pdf.setFont(
            undefined,
            'normal'
          );

        }


        if (
          answer === 'no'
        ) {

          pdf.setFont(
            undefined,
            'bold'
          );


          pdf.text(
            'X',
            181,
            y
          );


          pdf.setFont(
            undefined,
            'normal'
          );

        }


        y +=
          Math.max(
            8,
            lines.length * 5
          ) +
          2;

      }
    );


    // --------------------------------------------------------
    // DGSL TAKE BACK DETAILS
    // --------------------------------------------------------

    if (
      y > 235
    ) {

      pdf.addPage();

      y =
        20;


      if (logoData) {

        pdf.addImage(
          logoData,
          'PNG',
          140,
          10,
          55,
          11.1
        );

      }

    }


    y += 3;


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.setFontSize(
      12
    );


    pdf.text(
      'DGSL Take Back Details',
      margin,
      y
    );


    y += 7;


    pdf.setFontSize(
      10
    );


    addField(
      'Take Back Date',
      formatDate(data.takeBackDate)
    );


    addField(
      'All works complete to drawings',
      data.takeBackCompleteDrawings
    );


    addField(
      'Housekeeping at time of Take Back',
      data.takeBackHousekeeping
    );


    addField(
      'DG to Snag completed works',
      data.takeBackSnagCompleted
    );


    // --------------------------------------------------------
    // NOTES
    // --------------------------------------------------------

    if (
      y > 235
    ) {

      pdf.addPage();

      y =
        20;


      if (logoData) {

        pdf.addImage(
          logoData,
          'PNG',
          140,
          10,
          55,
          11.1
        );

      }

    }


    y += 3;


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.text(
      'Notes / Outstanding Items',
      margin,
      y
    );


    y += 6;


    pdf.setFont(
      undefined,
      'normal'
    );


    const noteLines =
      pdf.splitTextToSize(
        data.notes || '',
        pageWidth -
          margin * 2
      );


    pdf.text(
      noteLines,
      margin,
      y
    );


    y +=
      Math.max(
        12,
        noteLines.length * 5
      );


    // --------------------------------------------------------
    // SIGNATURES
    // --------------------------------------------------------

    if (
      y > 220
    ) {

      pdf.addPage();

      y =
        20;


      if (logoData) {

        pdf.addImage(
          logoData,
          'PNG',
          140,
          10,
          55,
          11.1
        );

      }

    }


    pdf.setFont(
      undefined,
      'bold'
    );


    pdf.text(
      'Signatures',
      margin,
      y
    );


    y += 8;


    pdf.setFont(
      undefined,
      'normal'
    );


    pdf.text(
      `Sub-Contractor Name: ${
        data.contractorSigner || ''
      }`,
      margin,
      y
    );


    y += 5;


    pdf.addImage(
      $('#contractorSignature')
        .toDataURL(
          'image/png'
        ),
      'PNG',
      margin,
      y,
      80,
      24
    );


    y += 32;


    pdf.text(
      `DGSL Representative: ${
        data.dgslSigner || ''
      }`,
      margin,
      y
    );


    y += 5;


    pdf.addImage(
      $('#dgslSignature')
        .toDataURL(
          'image/png'
        ),
      'PNG',
      margin,
      y,
      80,
      24
    );


    // --------------------------------------------------------
    // PHOTOS
    // --------------------------------------------------------

    const photoUrls =
      editing?.photos || [];


    if (
      photoUrls.length > 0
    ) {

      pdf.addPage();


      y =
        20;


      if (logoData) {

        pdf.addImage(
          logoData,
          'PNG',
          140,
          10,
          55,
          11.1
        );

      }


      pdf.setFontSize(
        16
      );


      pdf.setFont(
        undefined,
        'bold'
      );


      pdf.text(
        'SITE PHOTOS',
        margin,
        y
      );


      y += 10;


      for (
        const url
        of photoUrls
      ) {

        try {

          const imageData =
            await loadImageForPdf(
              url
            );


          y =
            await addImageToPdf(
              pdf,
              imageData,
              y,
              margin
            );


        } catch (error) {

          console.error(
            'Could not add photo to PDF:',
            error
          );

        }

      }

    }


    // --------------------------------------------------------
    // SAVE PDF
    // --------------------------------------------------------

    const safeZone =
      (
        data.zone ||
        'Handover'
      )
        .replace(
          /[^a-z0-9-_ ]/gi,
          ''
        )
        .replace(
          /\s+/g,
          '-'
        );


    if (viewOnly) {
      return pdf.output('blob');
    } else {
      pdf.save(
        `DGSL-${safeZone}-Handover-${today()}.pdf`
      );
    }


  } catch (error) {

    console.error(
      'PDF error:',
      error
    );


    alert(
      'There was a problem creating the PDF.\n\n' +
      error.message
    );

  }

}


// ============================================================
// LOAD LOGO FOR PDF
// ============================================================

function loadLogoForPdf() {

  return new Promise(
    resolve => {

      const img =
        new Image();


      img.onload =
        () => {

          const canvas =
            document.createElement(
              'canvas'
            );


          canvas.width =
            img.naturalWidth;


          canvas.height =
            img.naturalHeight;


          const ctx =
            canvas.getContext(
              '2d'
            );


          ctx.drawImage(
            img,
            0,
            0
          );


          resolve(
            canvas.toDataURL(
              'image/png'
            )
          );

        };


      img.onerror =
        () => {

          console.error(
            `Could not load ${LOGO_FILE}`
          );


          resolve(
            null
          );

        };


      img.src =
        LOGO_FILE;

    }
  );

}


// ============================================================
// LOAD IMAGE FOR PDF
// ============================================================

function loadImageForPdf(
  url
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const img =
        new Image();


      img.crossOrigin =
        'anonymous';


      img.onload =
        () => {

          const canvas =
            document.createElement(
              'canvas'
            );


          canvas.width =
            img.naturalWidth;


          canvas.height =
            img.naturalHeight;


          const ctx =
            canvas.getContext(
              '2d'
            );


          ctx.drawImage(
            img,
            0,
            0
          );


          resolve(
            canvas.toDataURL(
              'image/jpeg',
              0.85
            )
          );

        };


      img.onerror =
        reject;


      img.src =
        url;

    }
  );

}


// ============================================================
// ADD IMAGE TO PDF
// ============================================================

async function addImageToPdf(
  pdf,
  imageData,
  y,
  margin
) {

  if (
    y > 260
  ) {

    pdf.addPage();


    y =
      20;


    const logoData =
      await loadLogoForPdf();


    if (logoData) {

      pdf.addImage(
        logoData,
        'PNG',
        140,
        10,
        55,
        11.1
      );

    }

  }


  const dimensions =
    await getImageDimensions(
      imageData
    );


  const maxWidth =
    80;


  const maxHeight =
    65;


  let width =
    maxWidth;


  let height =
    (
      dimensions.height /
      dimensions.width
    ) *
    width;


  if (
    height >
    maxHeight
  ) {

    height =
      maxHeight;


    width =
      (
        dimensions.width /
        dimensions.height
      ) *
      height;

  }


  if (
    y + height >
    280
  ) {

    pdf.addPage();


    y =
      20;


    const logoData =
      await loadLogoForPdf();


    if (logoData) {

      pdf.addImage(
        logoData,
        'PNG',
        140,
        10,
        55,
        11.1
      );

    }

  }


  pdf.addImage(
    imageData,
    'JPEG',
    margin,
    y,
    width,
    height
  );


  return y +
    height +
    8;

}


// ============================================================
// IMAGE DIMENSIONS
// ============================================================

function getImageDimensions(
  src
) {

  return new Promise(
    resolve => {

      const img =
        new Image();


      img.onload =
        () => {

          resolve({

            width:
              img.width,

            height:
              img.height

          });

        };


      img.src =
        src;

    }
  );

}


// ============================================================
// START APPLICATION
// ============================================================

async function startApp() {

  try {

    addLogoToForm();

    await loadSupabase();

    await loadRecords();

    setupRealtime();

  } catch (error) {

    console.error(
      'Startup error:',
      error
    );


    alert(
      'The DGSL Site Register could not connect to Supabase.'
    );

  }

}


startApp();





// ============================================================
// PDF VIEWER CLOSE
// ============================================================

$('#closePdf').onclick =
  () => {

    const pdfDialog =
      $('#pdfDialog');

    pdfDialog.close();

    $('#pdfFrame').src = '';

  };