"""Точная копия логики lens.html + строгий боковой вид (ось разбора = горизонталь экрана).
Запуск: blender -b -P diag.py -- <glb> <out.png> <factor> [endcapGlue:0/1] [HLsubstr]"""
import bpy, sys, re
from mathutils import Vector
argv=sys.argv[sys.argv.index("--")+1:]
INP,OUT=argv[0],argv[1]
F=float(argv[2]) if len(argv)>2 else 1.0
CAPGLUE=(len(argv)>3 and argv[3]=='1')
HL=argv[4] if len(argv)>4 and argv[4] else None
CAM=argv[5] if len(argv)>5 else 'side'   # 'side' | 'iso'
MODE=argv[6] if len(argv)>6 else 'rank'  # 'rank' (REPLACE) | 'add' (ADD) | 'prop'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=INP)
sc=bpy.context.scene
for o in sc.objects: o.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in sc.objects if o.type=='MESH')
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
objs=[o for o in sc.objects if o.type=='MESH']

SWITCH=re.compile(r'Capsule|Object012|Object013|Object014|Object020|Object025|Object026|Object027|Object028')
TEXT=re.compile(r'logo|canon|#345|Sphere001',re.I)
EJECT=re.compile(r'Cylinder003')

def wbox(o):
    bb=[o.matrix_world@Vector(c) for c in o.bound_box]
    mn=Vector((min(c[k] for c in bb) for k in range(3)))
    mx=Vector((max(c[k] for c in bb) for k in range(3)))
    return mn,mx
box={o:wbox(o) for o in objs}
centers={o:(box[o][0]+box[o][1])/2 for o in objs}
gmn=Vector((min(box[o][0][k] for o in objs) for k in range(3)))
gmx=Vector((max(box[o][1][k] for o in objs) for k in range(3)))
center=(gmn+gmx)/2; size=gmx-gmn
axis=max(range(3),key=lambda i:size[i]); side=[i for i in range(3) if i!=axis]
axv=Vector((1 if i==axis else 0 for i in range(3)))

is_text={o:bool(TEXT.search(o.name)) for o in objs}
is_ej={o:bool(EJECT.search(o.name)) for o in objs}
def radial_len(o):
    r=centers[o]-center; r-=axv*(r.dot(axv)); return r.length
is_sw={o:(SWITCH.search(o.name) and not is_text[o] and not is_ej[o] and radial_len(o)>1e-4) for o in objs}

# панель — единое направление
sw=[o for o in objs if is_sw[o]]
swdir=Vector((0,0,0))
for o in sw:
    r=centers[o]-center; r-=axv*(r.dot(axv))
    if r.length>1e-6: swdir+=r.normalized()
if swdir.length>1e-6: swdir.normalize()

# follow-цели
follow={}
# кольца
tr=next((o for o in objs if 'top ring' in o.name and not is_text[o]),None)
br=next((o for o in objs if 'bottom ring' in o.name and not is_text[o]),None)
if tr and br: follow[br]=tr
# заглушка
if CAPGLUE:
    caps=[o for o in objs if 'end cap' in o.name and not is_text[o]]
    caps.sort(key=lambda o:centers[o][axis])
    if len(caps)>1:
        lead=caps[0]
        for c in caps[1:]: follow[c]=lead

# надписи следуют за деталью
def d2box(p,mn,mx):
    s=0
    for k in range(3):
        if p[k]<mn[k]: s+=(mn[k]-p[k])**2
        elif p[k]>mx[k]: s+=(p[k]-mx[k])**2
    return s
hosts=[o for o in objs if not is_text[o]]
swb=[box[o] for o in sw]
if swb:
    pmn=Vector((min(b[0][k] for b in swb)-0.03 for k in range(3)))
    pmx=Vector((max(b[1][k] for b in swb)+0.03 for k in range(3)))
else: pmn=pmx=None
def in_panel(p): return pmn is not None and all(pmn[k]<=p[k]<=pmx[k] for k in range(3))
for o in objs:
    if is_text[o]:
        pool = sw if in_panel(centers[o]) else hosts
        follow[o]=min(pool,key=lambda x:d2box(centers[o],*box[x]))

# ранговая раскладка структурных (не switch, не eject, не follow)
struct=[o for o in objs if not is_sw[o] and not is_ej[o] and o not in follow]
order=sorted(struct,key=lambda o:centers[o][axis])
n=len(order); L=size[axis]; EXPAND=1.0; SPREAD=1.2
gap=(L*EXPAND)/max(n-1,1)
rank={o:i for i,o in enumerate(order)}
target={o:center[axis]+(rank[o]-(n-1)/2)*gap for o in order}   # rank REPLACE
gap_add=(L*SPREAD)/max(n-1,1)

SWITCH_OUT=0.24
disp={}
for o in objs:
    if o in follow: continue
    if is_ej[o]:
        disp[o]=Vector((0,0,0))             # цилиндр убран (скрыт)
        if MODE!='rank': o.hide_render=True
    elif is_sw[o]:
        disp[o]=swdir*(L*SWITCH_OUT*F)
    elif MODE=='add':
        disp[o]=axv*((rank[o]-(n-1)/2)*gap_add*F)          # ADD: перёд->вперёд, зад->назад
    elif MODE=='prop':
        disp[o]=axv*((centers[o][axis]-center[axis])*SPREAD*F)
    else:
        disp[o]=axv*((target[o]-centers[o][axis])*F)       # rank REPLACE (старое)
for o in objs:
    if o in follow:
        root=follow[o]
        while root in follow: root=follow[root]
        disp[o]=disp.get(root,Vector((0,0,0)))
for o in objs: o.location=o.location+disp[o]

# разворот модели ГОРИЗОНТАЛЬНО (ось -> world X), как в lens.html
import mathutils
Rq=axv.rotation_difference(Vector((1,0,0)))
emp=bpy.data.objects.new("piv",None); sc.collection.objects.link(emp); emp.location=center
bpy.context.view_layer.update()
for o in objs:
    o.parent=emp; o.matrix_parent_inverse=emp.matrix_world.inverted()
emp.rotation_mode='QUATERNION'; emp.rotation_quaternion=Rq
bpy.context.view_layer.update()

# подсветка: HL = "sub1|sub2|sub3" -> красный/зелёный/синий
if HL:
    cols=[(1,0.05,0.05,1),(0.05,1,0.05,1),(0.15,0.4,1,1),(1,1,0.05,1),
          (1,0.4,0.0,1),(0.8,0.1,1,1),(0.0,1,1,1),(1,0.2,0.6,1)]
    for gi,sub in enumerate(HL.split("|")):
        mat=bpy.data.materials.new("HL%d"%gi); mat.use_nodes=True
        mat.node_tree.nodes["Principled BSDF"].inputs[0].default_value=cols[gi%len(cols)]
        for o in objs:
            if sub in o.name:
                o.data.materials.clear(); o.data.materials.append(mat)
                print("[d] HL[%d %s]"%(gi,sub),o.name)

# EEVEE + свет
sc.render.engine='BLENDER_EEVEE'
w=bpy.data.worlds.new("w"); sc.world=w; w.use_nodes=True
w.node_tree.nodes["Background"].inputs[0].default_value=(0.05,0.05,0.06,1)
sun=bpy.data.lights.new("s",'SUN'); sun.energy=4
so=bpy.data.objects.new("s",sun); sc.collection.objects.link(so); so.rotation_euler=(0.6,0.2,0.3)
tgt=bpy.data.objects.new("t",None); sc.collection.objects.link(tgt); tgt.location=center
camd=bpy.data.cameras.new("c"); cam=bpy.data.objects.new("c",camd); sc.collection.objects.link(cam)
sc.camera=cam; cam.constraints.new('TRACK_TO').target=tgt
# камера: модель теперь горизонтальна (ось = world X). Перёд(apos=1) -> +X.
d=max(size)*(3.0+EXPAND)
if CAM=='iso':   # 3/4 как в браузере (перёд СПРАВА): сбоку-сверху
    camloc=center + Vector((-0.30,-1.0,0.42))*d
else:            # строго сбоку (профиль)
    camloc=center + Vector((0.0,1.05,0.28))*d
cam.location=camloc
sc.render.resolution_x=1400; sc.render.resolution_y=650
sc.render.filepath=OUT
bpy.ops.render.render(write_still=True)
print("[d] rendered",OUT,"F=",F,"capglue=",CAPGLUE,"axis=","XYZ"[axis],"struct n=",n)
