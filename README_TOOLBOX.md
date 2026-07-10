# LillyTech Toolbox

LillyTech Toolbox agrega al catálogo un módulo dinámico para microherramientas. La sección pública lee herramientas activas desde Supabase y el panel `toolbox-admin.html` permite administrar herramientas, adopción e interesados con Supabase Auth.

## Archivos

- `Lillytech_catalogo_interactivoV2.html`: versión nueva del portal. No reemplaza el `V1`.
- `toolbox.css`: estilos públicos y del administrador.
- `toolbox.js`: lectura pública, filtros, tarjetas y ficha detallada.
- `toolbox-admin.html`: panel administrador.
- `toolbox-admin.js`: login, CRUD, dashboard y exportación CSV.
- `supabase_toolbox_setup.sql`: tablas, RLS, políticas e índices.

## 1. Ejecutar el SQL

1. Abrir Supabase.
2. Entrar al proyecto de LillyTech.
3. Ir a `SQL Editor`.
4. Pegar el contenido de `supabase_toolbox_setup.sql`.
5. Ejecutar el script completo.

El script crea solamente tablas con prefijo `toolbox_` y no modifica tablas existentes.

## 2. Crear el primer usuario administrador

1. En Supabase, ir a `Authentication > Users`.
2. Crear un usuario con email y contraseña.
3. Copiar el `User UID`.
4. En `SQL Editor`, ejecutar:

```sql
insert into public.toolbox_admins (user_id)
values ('PEGAR_AQUI_EL_USER_UID');
```

No se debe usar `service_role` en el navegador. El panel usa la llave publicable y las políticas RLS verifican que `auth.uid()` exista en `toolbox_admins`.

## 3. Registrar una herramienta

1. Abrir `toolbox-admin.html`.
2. Iniciar sesión con la cuenta administradora.
3. Entrar a `Herramientas`.
4. Completar nombre, descripción, URL, categoría, estado, etiquetas, usuarios objetivo, impacto y demás campos.
5. Marcar `Activa` para que aparezca en el portal público.
6. Guardar.

Si la URL está vacía, el portal mostrará `En preparación` y no permitirá abrirla.

## 4. Registrar quién la utiliza

1. En el admin, entrar a `Adopción`.
2. Seleccionar la herramienta.
3. Completar organización, proyecto o site, departamento, responsable, estado de uso, usuarios estimados y fecha de inicio.
4. Guardar.

Esta información no se muestra en el portal público.

## 5. Registrar quién podría necesitarla

1. En el admin, entrar a `Necesidades`.
2. Seleccionar la herramienta.
3. Completar organización, proyecto o site, departamento, contacto, nivel de necesidad y estado de seguimiento.
4. Guardar.

Esta información queda protegida por RLS y solo la ve una cuenta administradora.

## 6. Publicar en GitHub Pages

Subir juntos estos archivos al mismo directorio del portal:

- `Lillytech_catalogo_interactivoV2.html`
- `toolbox.css`
- `toolbox.js`
- `toolbox-admin.html`
- `toolbox-admin.js`

El portal funciona con HTML, CSS y JavaScript vanilla. Si Supabase falla temporalmente, solo la sección Toolbox muestra un mensaje de error; el catálogo principal sigue funcionando.
